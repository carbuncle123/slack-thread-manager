from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

from utils.file_handler import FileHandler
from utils.logger import get_logger

logger = get_logger(__name__)


class ChannelRollupBuilder:
    """channel_exports から project x user の日次・週次ロールアップを生成する"""

    def __init__(self, export_base_dir: Path, timezone: str = "Asia/Tokyo"):
        self.export_base_dir = export_base_dir
        self.timezone = timezone
        self.rollup_dir = self.export_base_dir / "_rollups"
        self.metadata_path = self.export_base_dir.parent / "channel_export" / "metadata.json"
        self.metadata_config = FileHandler.read_json(self.metadata_path) or {}
        FileHandler.ensure_dir(self.rollup_dir)

    def rebuild_rollups(self) -> Dict[str, Any]:
        self.metadata_config = FileHandler.read_json(self.metadata_path) or {}
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
            f"Rebuilt project/user rollups: {len(daily_rows)} daily rows, {len(weekly_rows)} weekly rows"
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
        display_name_map = self._user_display_name_map()

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

                    user_id = (msg.get("user") or "").strip() or "unknown_user"
                    user_name = display_name_map.get(user_id) or msg.get("user_name") or user_id
                    project_ids = self._resolve_project_ids(
                        channel_id=channel_id,
                        text=msg.get("text", "") or "",
                    )

                    for project_id in project_ids:
                        self._add_daily_message(
                            daily_agg=daily_agg,
                            date=date,
                            project_id=project_id,
                            user_id=user_id,
                            user_name=user_name,
                            channel_id=channel_id,
                            channel_name=channel_name,
                            msg=msg,
                        )
                        self._add_weekly_message(
                            weekly_agg=weekly_agg,
                            date=date,
                            project_id=project_id,
                            user_id=user_id,
                            user_name=user_name,
                            channel_id=channel_id,
                            channel_name=channel_name,
                            msg=msg,
                        )

        return self._serialize_daily_rows(daily_agg), self._serialize_weekly_rows(weekly_agg)

    def _resolve_project_ids(self, channel_id: str, text: str) -> List[str]:
        projects = self.metadata_config.get("projects", [])
        text_lower = text.lower()
        matched: List[str] = []

        for project in projects:
            project_id = (project.get("project_id") or "").strip()
            if not project_id:
                continue
            target_channel_ids = project.get("target_channel_ids", [])
            keywords = [k.strip().lower() for k in project.get("keywords", []) if k.strip()]

            matched_by_channel = bool(channel_id and channel_id in target_channel_ids)
            matched_by_keyword = any(keyword in text_lower for keyword in keywords)
            if matched_by_channel or matched_by_keyword:
                matched.append(project_id)

        if matched:
            return [v for v in dict.fromkeys(matched) if v]
        return ["unassigned_project"]

    def _user_display_name_map(self) -> Dict[str, str]:
        users = self.metadata_config.get("users", [])
        mapping: Dict[str, str] = {}
        for user in users:
            user_id = (user.get("user_id") or "").strip()
            display_name = (user.get("display_name") or "").strip()
            if user_id and display_name:
                mapping[user_id] = display_name
        return mapping

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
        user_id: str,
        user_name: str,
        channel_id: str,
        channel_name: str,
        msg: Dict[str, Any],
    ) -> None:
        key = (date, project_id, user_id)
        if key not in daily_agg:
            daily_agg[key] = {
                "date": date,
                "project_id": project_id,
                "user_id": user_id,
                "display_name": user_name,
                "message_count": 0,
                "thread_ts_set": set(),
                "channels_set": set(),
                "highlights": [],
            }

        row = daily_agg[key]
        row["message_count"] += 1
        row["channels_set"].add(channel_id or channel_name)

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
        user_id: str,
        user_name: str,
        channel_id: str,
        channel_name: str,
        msg: Dict[str, Any],
    ) -> None:
        week_start, week_end = self._week_range(date)
        key = (week_start, project_id, user_id)
        if key not in weekly_agg:
            weekly_agg[key] = {
                "week_start": week_start,
                "week_end": week_end,
                "project_id": project_id,
                "user_id": user_id,
                "display_name": user_name,
                "message_count": 0,
                "active_dates_set": set(),
                "channels_set": set(),
                "thread_scores": defaultdict(int),
            }

        row = weekly_agg[key]
        row["message_count"] += 1
        row["active_dates_set"].add(date)
        row["channels_set"].add(channel_id or channel_name)

        thread_ts = msg.get("thread_ts") or msg.get("ts")
        if thread_ts:
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
                    "user_id": row["user_id"],
                    "display_name": row["display_name"],
                    "message_count": row["message_count"],
                    "thread_count": len(row["thread_ts_set"]),
                    "channels": sorted(row["channels_set"]),
                    "highlights": highlights,
                }
            )

        rows.sort(key=lambda r: (r["date"], r["project_id"], r["user_id"]))
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
                    "user_id": row["user_id"],
                    "display_name": row["display_name"],
                    "message_count": row["message_count"],
                    "active_days": len(row["active_dates_set"]),
                    "channels": sorted(row["channels_set"]),
                    "top_threads": [
                        {"thread_ts": thread_ts, "reply_count": score}
                        for thread_ts, score in top_threads
                    ],
                }
            )

        rows.sort(key=lambda r: (r["week_start"], r["project_id"], r["user_id"]))
        return rows

    def _week_range(self, date_str: str) -> Tuple[str, str]:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        week_start = date_obj - timedelta(days=date_obj.weekday())
        week_end = week_start + timedelta(days=6)
        return week_start.isoformat(), week_end.isoformat()

