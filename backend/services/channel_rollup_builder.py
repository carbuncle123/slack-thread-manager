from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

from utils.file_handler import FileHandler
from utils.logger import get_logger

logger = get_logger(__name__)


class ChannelRollupBuilder:
    """channel_exports から日次・週次ロールアップを生成する"""

    def __init__(self, export_base_dir: Path, timezone: str = "Asia/Tokyo"):
        self.export_base_dir = export_base_dir
        self.timezone = timezone
        self.rollup_dir = self.export_base_dir / "_rollups"
        self.classification_path = self.export_base_dir.parent / "channel_export" / "classification.json"
        self.classification_config = FileHandler.read_json(self.classification_path) or {}
        FileHandler.ensure_dir(self.rollup_dir)

    def rebuild_rollups(self) -> Dict[str, Any]:
        self.classification_config = FileHandler.read_json(self.classification_path) or {}
        daily_rows, weekly_rows = self._aggregate_rows()

        generated_at = datetime.now().astimezone().isoformat()
        daily_doc = {
            "version": 1,
            "generated_at": generated_at,
            "timezone": self.timezone,
            "days": daily_rows,
        }
        weekly_doc = {
            "version": 1,
            "generated_at": generated_at,
            "timezone": self.timezone,
            "weeks": weekly_rows,
        }

        FileHandler.write_json(self.rollup_dir / "daily_rollup.json", daily_doc)
        FileHandler.write_json(self.rollup_dir / "weekly_rollup.json", weekly_doc)
        logger.info(
            f"Rebuilt channel rollups: {len(daily_rows)} daily rows, {len(weekly_rows)} weekly rows"
        )

        return {
            "daily": daily_doc,
            "weekly": weekly_doc,
        }

    def get_daily_rollup(self) -> Dict[str, Any]:
        path = self.rollup_dir / "daily_rollup.json"
        data = FileHandler.read_json(path)
        return data or self.rebuild_rollups()["daily"]

    def get_weekly_rollup(self) -> Dict[str, Any]:
        path = self.rollup_dir / "weekly_rollup.json"
        data = FileHandler.read_json(path)
        return data or self.rebuild_rollups()["weekly"]

    def _aggregate_rows(self) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        daily_agg: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
        weekly_agg: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

        for channel_dir in sorted(self.export_base_dir.iterdir()):
            if not channel_dir.is_dir() or channel_dir.name.startswith("_"):
                continue

            messages_dir = channel_dir / "messages"
            if not messages_dir.exists():
                continue

            for daily_file in sorted(messages_dir.rglob("*.json")):
                payload = FileHandler.read_json(daily_file)
                if not payload:
                    continue

                channel_id = payload.get("channel_id", "")
                channel_name = payload.get("channel_name", "")
                messages = payload.get("messages", [])
                for msg in messages:
                    date = self._resolve_date(msg)
                    if not date:
                        continue

                    project_ids = msg.get("project_ids") or self._classify_message_fallback(
                        msg=msg,
                        channel_id=channel_id,
                        category="projects",
                        default_ids=["unclassified_project"],
                    )
                    account_ids = msg.get("account_ids") or self._classify_message_fallback(
                        msg=msg,
                        channel_id=channel_id,
                        category="accounts",
                        default_ids=["unclassified_account"],
                    )

                    for project_id in project_ids:
                        for account_id in account_ids:
                            self._add_daily_message(
                                daily_agg=daily_agg,
                                date=date,
                                project_id=project_id,
                                account_id=account_id,
                                channel_id=channel_id,
                                channel_name=channel_name,
                                msg=msg,
                            )
                            self._add_weekly_message(
                                weekly_agg=weekly_agg,
                                date=date,
                                project_id=project_id,
                                account_id=account_id,
                                channel_id=channel_id,
                                channel_name=channel_name,
                                msg=msg,
                            )

        daily_rows = self._serialize_daily_rows(daily_agg)
        weekly_rows = self._serialize_weekly_rows(weekly_agg)
        return daily_rows, weekly_rows

    def _resolve_date(self, msg: Dict[str, Any]) -> str:
        created_at = msg.get("created_at")
        if created_at and len(created_at) >= 10:
            return created_at[:10]

        ts = msg.get("ts")
        if ts:
            return datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d")
        return ""

    def _add_daily_message(
        self,
        daily_agg: Dict[Tuple[str, str, str], Dict[str, Any]],
        date: str,
        project_id: str,
        account_id: str,
        channel_id: str,
        channel_name: str,
        msg: Dict[str, Any],
    ) -> None:
        key = (date, project_id, account_id)
        if key not in daily_agg:
            daily_agg[key] = {
                "date": date,
                "project_id": project_id,
                "account_id": account_id,
                "message_count": 0,
                "thread_ts_set": set(),
                "participants_set": set(),
                "channels_set": set(),
                "highlights": [],
            }

        row = daily_agg[key]
        row["message_count"] += 1
        row["channels_set"].add(channel_id or channel_name)

        user_id = msg.get("user") or msg.get("user_name")
        if user_id:
            row["participants_set"].add(user_id)

        thread_ts = msg.get("thread_ts") or msg.get("ts")
        if thread_ts:
            row["thread_ts_set"].add(thread_ts)

        reply_count = int(msg.get("reply_count", 0) or 0)
        if reply_count > 0:
            row["highlights"].append(
                {
                    "thread_ts": thread_ts,
                    "message_ts": msg.get("ts"),
                    "summary_hint": (msg.get("text") or "")[:120],
                    "reply_count": reply_count,
                }
            )

    def _add_weekly_message(
        self,
        weekly_agg: Dict[Tuple[str, str, str], Dict[str, Any]],
        date: str,
        project_id: str,
        account_id: str,
        channel_id: str,
        channel_name: str,
        msg: Dict[str, Any],
    ) -> None:
        week_start, week_end = self._week_range(date)
        key = (week_start, project_id, account_id)
        if key not in weekly_agg:
            weekly_agg[key] = {
                "week_start": week_start,
                "week_end": week_end,
                "project_id": project_id,
                "account_id": account_id,
                "message_count": 0,
                "active_dates_set": set(),
                "participants_set": set(),
                "channels_set": set(),
                "thread_scores": defaultdict(int),
            }

        row = weekly_agg[key]
        row["message_count"] += 1
        row["active_dates_set"].add(date)
        row["channels_set"].add(channel_id or channel_name)

        user_id = msg.get("user") or msg.get("user_name")
        if user_id:
            row["participants_set"].add(user_id)

        thread_ts = msg.get("thread_ts") or msg.get("ts")
        if thread_ts:
            # 返信数が多いスレッドを週次の注目スレッドとして扱う
            row["thread_scores"][thread_ts] = max(
                row["thread_scores"][thread_ts],
                int(msg.get("reply_count", 0) or 0),
            )

    def _serialize_daily_rows(self, daily_agg: Dict[Tuple[str, str, str], Dict[str, Any]]) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        for row in daily_agg.values():
            highlights = sorted(
                row["highlights"],
                key=lambda h: (h.get("reply_count", 0), h.get("message_ts", "")),
                reverse=True,
            )[:5]
            for h in highlights:
                h.pop("reply_count", None)

            rows.append(
                {
                    "date": row["date"],
                    "project_id": row["project_id"],
                    "account_id": row["account_id"],
                    "message_count": row["message_count"],
                    "thread_count": len(row["thread_ts_set"]),
                    "participants": sorted(row["participants_set"]),
                    "channels": sorted(row["channels_set"]),
                    "highlights": highlights,
                }
            )

        rows.sort(key=lambda r: (r["date"], r["project_id"], r["account_id"]))
        return rows

    def _serialize_weekly_rows(self, weekly_agg: Dict[Tuple[str, str, str], Dict[str, Any]]) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        for row in weekly_agg.values():
            top_threads = sorted(
                row["thread_scores"].items(),
                key=lambda kv: kv[1],
                reverse=True,
            )[:5]

            rows.append(
                {
                    "week_start": row["week_start"],
                    "week_end": row["week_end"],
                    "project_id": row["project_id"],
                    "account_id": row["account_id"],
                    "message_count": row["message_count"],
                    "active_days": len(row["active_dates_set"]),
                    "participants": sorted(row["participants_set"]),
                    "channels": sorted(row["channels_set"]),
                    "top_threads": [
                        {"thread_ts": thread_ts, "reply_count": score}
                        for thread_ts, score in top_threads
                    ],
                }
            )

        rows.sort(key=lambda r: (r["week_start"], r["project_id"], r["account_id"]))
        return rows

    def _week_range(self, date_str: str) -> Tuple[str, str]:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        week_start = date_obj - timedelta(days=date_obj.weekday())
        week_end = week_start + timedelta(days=6)
        return week_start.isoformat(), week_end.isoformat()

    def _classify_message_fallback(
        self,
        msg: Dict[str, Any],
        channel_id: str,
        category: str,
        default_ids: List[str],
    ) -> List[str]:
        config = self.classification_config
        definitions = config.get(category, [])
        defaults = config.get("defaults", {})
        category_default_ids = defaults.get(
            "project_ids" if category == "projects" else "account_ids",
            default_ids,
        )

        text = (msg.get("text") or "").lower()
        user_id = (msg.get("user") or "").strip()
        matched_ids: List[str] = []

        for item in definitions:
            match = item.get("match", {})
            channels = match.get("channels", [])
            keywords = match.get("keywords", [])
            users = match.get("users", [])

            if channel_id and channel_id in channels:
                matched_ids.append(item.get("id"))
                continue
            if user_id and user_id in users:
                matched_ids.append(item.get("id"))
                continue
            for keyword in keywords:
                keyword_normalized = (keyword or "").strip().lower()
                if keyword_normalized and keyword_normalized in text:
                    matched_ids.append(item.get("id"))
                    break

        normalized = [v for v in dict.fromkeys(matched_ids) if v]
        if normalized:
            return normalized
        return [v for v in dict.fromkeys(category_default_ids) if v] or default_ids
