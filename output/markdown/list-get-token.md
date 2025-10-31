---
title: 获取 Token 接口
source: https://docs.hitem3d.ai/zh/api/api-reference/list/get-token
retrieved_at: 2025-10-31
---

<!-- chunk_id: list-get-token-chunk-01 -->

# 获取 Token 接口

## 接口概述

**请求其他接口前需要先获取token(有效期24h)**

| 网络协议 | 请求地址 | 请求方法 | 鉴权方式 | 请求格式 | 响应格式 |
| --- | --- | --- | --- | --- | --- |
| HTTP | /open-api/v1/auth/token | `POST` | Basic | application/json | application/json |

## 请求头（Headers）

| 参数名称 | 值 | 描述 |
| --- | --- | --- |
| Authorization | Basic base64(client_id:client_secret) | 使用 Base64 编码的客户端凭证进行 Basic 认证 |
| Content-Type | application/json | 请求体类型 |

```c
String client_id = "kqJeYqXfV4H8pSt4LyxnR_cM3Z1kJTuNeqbCMwKxTSI87yfTrdzu766Dx8t5-6oP";
String client_secret = "+3bZoDrT31n2Qs+hsOxuPMzh40lC7+NdzIGgmntIhbe34cWxr1scIeZPcmZnMOx6";

String basicAuth = "Basic " + Base64.getEncoder().encodeToString(
        (client_id + ":" + client_secret).getBytes(StandardCharsets.UTF_8)
);
```

## 请求体（Body）

```plain
POST /open-api/v1/auth/token HTTP/1.1
Host: http://api.hitem3d.com
Authorization: Basic Y2xpZW50X2lkOmNsaWVudF9zZWNyZXQ=
Content-Type: application/json
```

## 响应体（Response）

| 参数名称 | 子字段 | 类型 | 描述 |
| --- | --- | --- | --- |
| code | - | String | 错误码，具体见错误码表 |
| data | accessToken | String | 访问令牌，用于后续 API 调用 |
|  | tokenType | String | 令牌类型 Bearer |
|  | nonce | String | 随机数，用于安全验证 |
| msg | - | String | 具体错误信息 |

<!-- chunk_id: list-get-token-chunk-02 -->

```bash
HTTP/1.1 200 OK
Content-Type: application/json

{
  "code": 200,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "nonce": "1623456789000hitem3d"
  }
}
```

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "code": 40010000,
  "message": "client credentials are invalid",
  "data": {}
}
```

## 错误码（Error Code）

错误码按照JSON结构返回，包括code和msg字段；随着版本更新，我们会扩展对应字段的值。

```json
{
    "code": 40010000,
    "data": {},
    "msg": "client credentials are invalid"
}
```

| 错误码 | 错误信息 | 错误描述 |
| --- | --- | --- |
| 40010000 | client credentials are invalid | client_id 或 client_secret 错误 |
| 10000000 | system error | 服务器内部错误 |

## 请求示例（Shell & Python）

Shell

```shell
curl --location --request POST 'https://api.hitem3d.ai/open-api/v1/auth/token' \
--header 'Authorization: Basic xxx' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--header 'Host: api.hitem3d.ai' \
--header 'Connection: keep-alive'
```

Python

<!-- chunk_id: list-get-token-chunk-03 -->

```python
import requests
import json

url = "https://api.hitem3d.ai/open-api/v1/auth/token"

payload={}
headers = {
   'Authorization': 'Basic xxx',
   'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
   'Content-Type': 'application/json',
   'Accept': '*/*',
   'Host': 'api.hitem3d.ai',
   'Connection': 'keep-alive'
}

response = requests.request("POST", url, headers=headers, data=payload)

print(response.text)
```
