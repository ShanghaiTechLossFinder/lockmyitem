import json
import os
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from openai import OpenAI
from pydantic import BaseModel
from ultralytics import YOLO


app = FastAPI(title="ShanghaiTech Lost & Found Model Service")

MODEL_API_KEY = os.getenv("MODEL_API_KEY", "")
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8n.pt")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

_yolo_model: Optional[YOLO] = None


class ImageRequest(BaseModel):
    imageUrl: str
    fileId: Optional[str] = ""
    hint: Optional[str] = ""


def require_auth(authorization: Optional[str] = Header(default=None)) -> None:
    if not MODEL_API_KEY:
        return
    expected = f"Bearer {MODEL_API_KEY}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="invalid model api key")


def get_yolo_model() -> YOLO:
    global _yolo_model
    if _yolo_model is None:
        _yolo_model = YOLO(YOLO_MODEL)
    return _yolo_model


def normalize_label(label: str) -> str:
    mapping = {
        "umbrella": "\u96e8\u4f1e",
        "bottle": "\u6c34\u676f",
        "cup": "\u6c34\u676f",
        "cell phone": "\u624b\u673a",
        "cell_phone": "\u624b\u673a",
        "laptop": "\u7535\u8111",
        "book": "\u4e66\u672c\u8d44\u6599",
        "backpack": "\u4e66\u5305",
        "handbag": "\u5305",
        "suitcase": "\u884c\u674e\u7bb1",
        "tie": "\u6302\u4ef6",
    }
    return mapping.get(label.lower(), label)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"ok": "true"}


@app.post("/yolo", dependencies=[Depends(require_auth)])
def yolo_detect(payload: ImageRequest) -> Dict[str, List[Dict[str, Any]]]:
    model = get_yolo_model()
    results = model.predict(source=payload.imageUrl, conf=0.25, verbose=False)
    objects: List[Dict[str, Any]] = []
    for result in results:
        names = result.names
        for box in result.boxes:
            class_id = int(box.cls[0])
            raw_label = names.get(class_id, str(class_id))
            xyxy = [round(float(value), 2) for value in box.xyxy[0].tolist()]
            objects.append(
                {
                    "label": normalize_label(raw_label),
                    "rawLabel": raw_label,
                    "confidence": round(float(box.conf[0]), 4),
                    "bbox": xyxy,
                    "attributes": {},
                }
            )
    return {"objects": objects}


@app.post("/semantic", dependencies=[Depends(require_auth)])
def semantic_tags(payload: ImageRequest) -> Dict[str, Any]:
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    client = OpenAI()
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "description": {"type": "string"},
            "category": {"type": "string"},
            "tags": {"type": "array", "items": {"type": "string"}},
            "colors": {"type": "array", "items": {"type": "string"}},
            "accessories": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["description", "category", "tags", "colors", "accessories"],
    }

    prompt = (
        "You are a campus lost-and-found image recognition assistant. "
        "Return strict JSON in Chinese. Identify the item category, colors, "
        "brand or text, accessories, stickers, keychains, scratches, and other "
        "distinctive marks. "
        f"User hint: {payload.hint or 'none'}"
    )

    response = client.responses.create(
        model=OPENAI_MODEL,
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": payload.imageUrl, "detail": "high"},
                ],
            }
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "lost_found_image_tags",
                "schema": schema,
                "strict": True,
            }
        },
    )

    parsed = json.loads(response.output_text)
    return {
        "description": parsed["description"],
        "category": parsed["category"],
        "tags": parsed["tags"],
        "colors": parsed["colors"],
        "accessories": parsed["accessories"],
        "imageEmbedding": [],
        "semanticEmbedding": [],
    }
