# 腾讯云混元图像识别接入说明

web 前端不能直接调用混元模型，也不能暴露任何服务端凭据。当前主链路是：

1. 浏览器端在 `web/src/vision.js` 压缩图片。
2. 浏览器通过 CloudBase Web SDK 调用 `lostfound` 云函数的 `classifyImage` action。
3. 云函数在服务端读取混元或腾讯云凭据。
4. 云函数调用腾讯云混元视觉模型。
5. 云函数返回结构化分类、标签和描述。
6. web 前端将这些字段写入发布表单，并用于相似物品匹配。

可选后端代理是 `web/api/classify-image.js`。只有在它完成认证、来源限制、速率限制和图片大小限制后，才应启用。

## 云函数凭据

在 CloudBase 控制台给 `cloudfunctions/lostfound` 配置模型服务凭据。公开仓库不记录任何示例密钥、token、cookie 或私钥。

支持两种模式：

- 腾讯云签名调用。
- OpenAI-compatible 混元接口。

说明：

- 模型名称默认使用视觉多模态模型，可按腾讯云控制台可用模型调整。
- 旧模型服务配置仅作兼容备用，不建议新配置继续使用。
- 不再需要 `YOLO_API_URL`、`SEMANTIC_API_URL`、`YOLO_MODEL` 或自建 `model-service`。

## classifyImage 请求

CloudBase 云函数 action：

```json
{
  "action": "classifyImage",
  "imageBase64": "<base64 image payload>",
  "mimeType": "image/jpeg",
  "hint": "用户填写的标题、描述或地点提示",
  "purpose": "item"
}
```

`purpose` 可为：

- `item`：识别失物本体。
- `locationDetail`：识别方位补充图片，只提取可帮助定位的空间线索。

云函数仍兼容 `imageUrl` 和 `fileId`，但 web 主线默认发送压缩后的 `imageBase64`。

## 混元返回 JSON 约定

云函数会要求模型只返回 JSON：

```json
{
  "title": "黑色折叠伞",
  "description": "黑色折叠雨伞，伞柄处有红色钥匙扣。",
  "category": "雨伞",
  "tags": ["雨伞", "折叠", "红色钥匙扣"],
  "colors": ["黑色", "红色"],
  "accessories": ["钥匙扣"],
  "objects": ["雨伞"]
}
```

## 云函数最终返回

`classifyImage` 返回：

```json
{
  "ok": true,
  "data": {
    "title": "黑色折叠伞",
    "category": "雨伞",
    "aiTags": ["雨伞", "黑色", "折叠", "红色钥匙扣"],
    "yoloObjects": ["雨伞"],
    "semanticTags": ["雨伞", "折叠", "红色钥匙扣"],
    "visualDescription": "黑色折叠雨伞，伞柄处有红色钥匙扣。",
    "imageEmbedding": [],
    "semanticEmbedding": [],
    "modelSources": {
      "provider": "tencent-hunyuan-compatible",
      "baseUrl": "configured service endpoint",
      "model": "hunyuan-vision"
    }
  }
}
```

`yoloObjects` 仍保留是为了兼容现有前端字段，不代表当前链路仍依赖 YOLO。
