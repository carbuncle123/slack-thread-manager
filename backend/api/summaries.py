"""要約API エンドポイント"""
from fastapi import APIRouter, HTTPException
from models.summary import ThreadSummary, SummaryGenerationRequest, SummaryResponse
from services.summary_generator import SummaryGenerator
from utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter(prefix="/api/summaries", tags=["summaries"])

# グローバル変数（main.pyで初期化）
summary_generator: SummaryGenerator = None


def set_summary_generator(generator: SummaryGenerator):
    """SummaryGeneratorを設定"""
    global summary_generator
    summary_generator = generator


@router.get("/{thread_id}", response_model=ThreadSummary)
async def get_summary(thread_id: str):
    """
    スレッドの要約を取得

    存在しない場合は自動生成
    """
    try:
        summary = await summary_generator.get_summary(thread_id)
        return summary

    except ValueError as e:
        logger.error(f"要約取得エラー: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        logger.error(f"要約取得エラー: {str(e)}")
        raise HTTPException(status_code=500, detail="要約の取得に失敗しました")


@router.post("/generate", response_model=SummaryResponse)
async def generate_summary(request: SummaryGenerationRequest):
    """
    スレッドの要約を生成

    force_regenerate=True の場合、既存の要約を無視して再生成
    """
    try:
        summary = await summary_generator.generate_summary(
            thread_id=request.thread_id,
            force_regenerate=request.force_regenerate
        )

        return SummaryResponse(
            success=True,
            summary=summary,
            message="要約の生成に成功しました"
        )

    except ValueError as e:
        logger.error(f"要約生成エラー: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        logger.error(f"要約生成エラー: {str(e)}")
        raise HTTPException(status_code=500, detail="要約の生成に失敗しました")


@router.delete("/{thread_id}")
async def delete_summary(thread_id: str):
    """要約を削除"""
    try:
        success = summary_generator.delete_summary(thread_id)

        if not success:
            raise HTTPException(status_code=404, detail="要約が見つかりません")

        return {
            "success": True,
            "message": "要約を削除しました"
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"要約削除エラー: {str(e)}")
        raise HTTPException(status_code=500, detail="要約の削除に失敗しました")
