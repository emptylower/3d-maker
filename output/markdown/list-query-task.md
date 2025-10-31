---
title: 查询任务接口
source: https://docs.hitem3d.ai/zh/api/api-reference/list/query-task
retrieved_at: 2025-10-31
---

<!-- chunk_id: list-query-task-chunk-01 -->

# 查询任务接口

## 接口概述

**用于根据任务 ID 查询 3D 模型生成任务的当前状态及结果信息。**

| 网络协议 | 请求地址 | 请求方法 | 鉴权方式 | 请求格式 | 响应格式 |
| --- | --- | --- | --- | --- | --- |
| HTTP | /open-api/v1/query-task | `GET` | Bearer | application/json | application/json |

## 请求头（Headers）

| 参数名称 | 值 | 描述 |
| --- | --- | --- |
| Content-Type | application/json | 数据交换格式 |
| Authorization | Bearer | 将{accessToken}替换为您上面接口获取的accessToken |

```json
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## 请求参数（HTTP GET）

| 参数名称 | 类型 | 必选 | 描述 |
| --- | --- | --- | --- |
| task_id | String | 是 | 任务id，由创建任务接口创建成功返回 |

```plain
http://api.hitem3d.com/open-api/v1/query-task?task_id=caf4562ed96540d99faf421a1722b82e.jjewelry-aigc-api.3BCRb4Wp9d
```

## 响应体（Response）

| 参数名称 | 子字段 | 类型 | 描述 |
| --- | --- | --- | --- |
| code | - | String | 错误码，具体见错误码表 |
| data | task_id | String | 任务id |
|  | state | String | 处理状态 <br>• 创建成功：created <br>• 任务排队中：queueing <br>• 任务处理中：processing <br>• 任务成功：success <br>• 任务失败：failed |
|  | id | String | 生成物id，用来标识不同的生成物 |
|  | cover_url | String | 生成物封面图URL， 一个小时有效期 |
|  | url | String | 生成物URL， 一个小时有效期 |
| msg | - | String | 具体错误信息 |

<!-- chunk_id: list-query-task-chunk-02 -->

```json
{
    "code": 200,
    "data": {
        "task_id": "2c2ad20cb3204697ba7f80351c3e8606.jjewelry-aigc-api.1NraEb5ohU",
        "state": "success",
        "id": "2c2ad20cb3204697ba7f80351c3e8606.jjewelry-aigc-api.1NraEb5ohU_0",
        "url": "https://hitem3dstatic.zaohaowu.net/jjewelry/web/model3ds/img2model3d/20250723/b88e564c1aea4ae78dd550705d4d2fb1/target//original/0.glb",        
        "cover_url": "https://hitem3dstatic.zaohaowu.net/jjewelry/web/model3ds/img2model3d/20250820/d30769c2cd054040b7a6d8a88542e300/target/cover/webp/0.webp"
    },
    "msg": "success"
}
```

## 错误码（Error Code）

错误码按照JSON结构返回，包括code和msg字段；随着版本更新，我们会扩展对应字段的值

```json
{
    "code": 50010001,
    "data": {},
    "msg": "generate failed"
}
```

| 错误码 | 错误信息 | 错误描述 |
| --- | --- | --- |
| 50010001 | generate failed | 超时或模型无法解析传图，任务生成失败，请重试；所耗积分已退还 |

## 请求示例（Shell & Python）

Shell

<!-- chunk_id: list-query-task-chunk-03 -->

```shell
curl --location --request GET 'https://api.hitem3d.ai/open-api/v1/query-task?task_id=14fb7ecb7b3b467f80cd4bb16e4a44cd.jjewelry-aigc-merchant-api.ZCqTyPcTwV' \
--header 'Authorization: Bearer 6pzBx1a5Cj68XhQe*H07YsrAYSIuSptfihGpHd40QTd3RtfRWy-ao9F12AqYUYdedxmbL0Yl2F8HO9nbhFuIs0hhoaJAd7GUAlgfp2nbHlqTJIBphEHgw_oVAtp9VQtN-mS_uUTwUejcENG4WzwAPtTsJBIZQzGjU_xJzZvnQPPPxaSQaPEBNsekNRFzMLq8us4W3zJJa8P3G0EVnQQ1_jhO6X4ycMBKfqS8GXALZntk-4vkykA4sZxU6edoQEjKGC6oT_dRK3GzevCxI1uvYvwmsNjZYe4G7uDlkNAuny6EdDiBqb3hpf4jETA_mv5ItAJvccd5S91_IJEV0v5uBALrkuD-bDuneLIi2h6-11et4gmAA5_00XgOq8OJDcJ3LUI71Jw==*WeNzV21CwM-cyccZ8BQmfNZn3hViOpTMLg1kJQnb0WI=' \
--header 'Appid: 20009998' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
--header 'Accept: */*' \
--header 'Host: api.hitem3d.ai' \
--header 'Connection: keep-alive'
```

Python

<!-- chunk_id: list-query-task-chunk-04 -->

```python
import requests

url = "https://api.hitem3d.ai/open-api/v1/query-task?task_id=14fb7ecb7b3b467f80cd4bb16e4a44cd.jjewelry-aigc-merchant-api.ZCqTyPcTwV"

payload={}
headers = {
   'Authorization': 'Bearer 6pzBx1a5Cj68XhQe*H07YsrAYSIuSptfihGpHd40QTd3RtfRWy-ao9F12AqYUYdedxmbL0Yl2F8HO9nbhFuIs0hhoaJAd7GUAlgfp2nbHlqTJIBphEHgw_oVAtp9VQtN-mS_uUTwUejcENG4WzwAPtTsJBIZQzGjU_xJzZvnQPPPxaSQaPEBNsekNRFzMLq8us4W3zJJa8P3G0EVnQQ1_jhO6X4ycMBKfqS8GXALZntk-4vkykA4sZxU6edoQEjKGC6oT_dRK3GzevCxI1uvYvwmsNjZYe4G7uDlkNAuny6EdDiBqb3hpf4jETA_mv5ItAJvccd5S91_IJEV0v5uBALrkuD-bDuneLIi2h6-11et4gmAA5_00XgOq8OJDcJ3LUI71Jw==*WeNzV21CwM-cyccZ8BQmfNZn3hViOpTMLg1kJQnb0WI=',
   'Appid': '20009998',
   'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
   'Accept': '*/*',
   'Host': 'api.hitem3d.ai',
   'Connection': 'keep-alive'
}

response = requests.request("GET", url, headers=headers, data=payload)

print(response.text)
```
