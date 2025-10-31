---
title: 创建任务接口
source: https://docs.hitem3d.ai/zh/api/api-reference/list/create-task
retrieved_at: 2025-10-31
---

<!-- chunk_id: list-create-task-chunk-01 -->

# 创建任务接口

## 接口概述

**根据输入的图片生成3D模型。**

| 网络协议 | 请求地址 | 请求方法 | 鉴权方式 | 请求格式 | 响应格式 |
| --- | --- | --- | --- | --- | --- |
| HTTP | /open-api/v1/submit-task | `POST` | Bearer | application/json | application/json |

## 请求头（Headers）

| 参数名称 | 值 | 描述 |
| --- | --- | --- |
| Content-Type | application/json | 数据交换格式 |
| Authorization | Bearer | 将{accessToken}替换为您上面接口获取的accessToken |

## 请求体（HTTP Form表单提交）

<!-- chunk_id: list-create-task-chunk-02 -->

| 参数名称 | 类型 | 必填 | 参数描述 |
| --- | --- | --- | --- |
| request_type | int | 是 | 请求类型，默认为 几何+纹理，即 3 <br>枚举值： <br>• 1： mesh ，即仅生成纯几何 <br>• 2：texture，即分阶段生成，基于已生成的几何模型，生成纹理模型 <br>• 3： both，即一次性生成几何+纹理模型 |
| model | String | 是 | 模型版本，包括通用模型和场景模型，默认为 <br>枚举值： <br>• 通用模型：hitem3dv1，hitem3dv1.5 <br>• 场景模型：scene-portraitv1.5 |
| images | file | 是，跟multi_images二选一 | 上传图像，模型将以此参数中传入的图片来生成3D模型，（单图生3D） <br>• 类型：支持上传 form 文件的方式提交图片 <br>• 格式：图片支持 png、jpeg、.jpg、webp格式 <br>• 大小：图片大小不超过 20 MB <br>• 数量：只支持输入 1 张图 |
| multi_images | file | 是，跟images二选一 | 上传图像数组，模型将以此参数中传入的图片来生成3D模型（多视图生3D） <br>• 类型：支持上传 form 文件的方式提交图片 <br>• 格式：图片支持 png、jpeg、.jpg、webp格式 <br>• 大小：单张图片大小不超过 20 MB <br>• 数量：最多4张图片，依次为前视图、后视图、左视图、右视图 |
| resolution | int | 否 | 分辨率，默认为1024³ <br>• v1.0枚举值：512、1024、1536 <br>• v1.5枚举值：512、1024、1536、1536pro <br>• scene-portraitv1.5枚举值：1536 |
| mesh_url | string | 否 | 上传的Url 必须为Hitem3D 返回的 几何模型 Url <br>仅当 `request_type=2`（"基于几何模型，生成纹理模型"）时必填；示例： <br>• [https://hitem3dstatic.zaohaowu.net/jjewelry/web/model3ds/img2model3d/20250722/79c8488490c2498785468e5203e77b6a/target//original/0.glb](https://hitem3dstatic.zaohaowu.net/jjewelry/web/model3ds/img2model3d/20250722/79c8488490c2498785468e5203e77b6a/target//original/0.glb) |
| face | int | 否 | 模型面数，支持自定义配置，取值范围为100000～2000000 <br>不同分辨率对应的推荐面数不一致： <br>• 512³：500000 <br>• 1024³：1000000 <br>• 1536³：2000000 <br>• 1536³ Pro：2000000 |
| format | int | 否 | 生成模型的格式，仅限制一种生成格式，默认为1 obj 格式 <br>枚举值： <br>• 1：obj <br>• 2：glb <br>• 3：stl <br>• 4：fbx |
| callback_url | String | 可选 | Callback 协议 <br>需要您在创建任务时主动设置 callback_url，请求方法为 POST，当模型生成任务有状态变化时，Hitem3D 将向此地址发送包含任务最新状态的回调请求。回调请求内容结构与查询任务API的返回体一致 <br>回调返回的"status"包括以下状态： <br>• success 任务完成（如发送失败，回调三次） <br>• failed 任务失败（如发送失败，回调三次） |

<!-- chunk_id: list-create-task-chunk-03 -->

## 响应体（Response）

| 参数名称 | 子字段 | 类型 | 描述 |
| --- | --- | --- | --- |
| code | - | String | 错误码，具体见错误码表 |
| data | task_id | String | Hitem3D 生成的异步任务ID，生成结果需要通过使用此id在异步任务查询接口中获取。 |
| msg | - | String | 具体错误信息 |

```json
{
    "code": 200,
    "data": {
        "task_id": "528f172b66554be2a2d1e95db4454a5a.jjewelry-aigc-api.7qbh5Z0wfR",
    },
    "msg": "success"
}
```

## 错误码（Error Code）

错误码按照JSON结构返回，包括code和msg字段；随着版本更新，我们会扩展对应字段的值

```json
{
    "code": 30010000,
    "data": {},
    "msg": "balance is not enough"
}
```

<!-- chunk_id: list-create-task-chunk-04 -->

| 错误码 | 错误信息 | 错误描述 |
| --- | --- | --- |
| 30010000 | balance is not enough | 积分余额不足，请联系服务方增加积分 |
| 10031001 | Upload file size exceeds limit | 上传文件超过20MB |
| 10031002 | Face not valid | 面数不合理，取值范围为100000～2000000 |
| 10031003 | Resolution not valid | 分辨率不合理，需参照 <br>• v1.0枚举值：512、1024、1536 <br>• v1.5枚举值：512、1024、1536、1536pro |
| 10031004 | format not support | 格式不支持，枚举值： <br>• 1：obj <br>• 2：glb <br>• 3：stl <br>• 4：fbx |
| 10031005 | images only allow png jpeg jpg webp | 图片类型出错，仅支持上传格式为png、jpeg、jpg、webp的图片 |
| 10031006 | model only allow hitem3dv1 hitem3dv1.5 | 模型只能是hitem3dv1和hitem3dv1.5、portrait |
| 10031007 | both images and multi images provided | 图片和多视图不能同时上传 |
| 10031008 | images or multi images required | 图片和多视图必须上传一个 |
| 10031009 | multi images count exceeds limit | 多视图最多支持4个文件 |
| 10031010 | empty file not allowed | 文件不能为空（请使用合适的http表单方式提交，具体参考请求示例） |
| 10031011 | mesh url required when request type 2 | mesh_url不能为空 |
| 10031012 | mesh_url_must_start_with_http | mesh_url必须以http开头 |
| 10000000 | system error | 系统内部异常 |

## 请求示例（Shell & Python）

### Shell-单图生3D- 一次性生成（几何+纹理）

<!-- chunk_id: list-create-task-chunk-05 -->

```shell
curl --location --request POST 'https://api.hitem3d.ai/open-api/v1/submit-task' \
--header 'Authorization: Bearer 6pzBx1a5Cj68XhQe*H07YsrAYSIuSptfihGpHd40QTd3RtfRWy-ao9F12AqYUYdedxmbL0Yl2F8HO9nbhFuIs0hhoaJAd7GUAlgfp2nbHlqTJIBphEHgw_oVAtp9VQtN-mS_uUTwUejcENG4WzwAPtTsJBIZQzGjU_xJzZvnQPPPxaSQaPEBNsekNRFzMLq8us4W3zJJa8P3G0EVnQQ1_jhO6X4ycMBKfqS8GXALZntk-4vkykA4sZxU6edoQEjKGC6oT_dRK3GzevCxI1uvYvwmsNjZYe4G7uDlkNAuny6EdDiBqb3hpf4jETA_mv5ItAJvccd5S91_IJEV0v5uBALrkuD-bDuneLIi2h6-11et4gmAA5_00XgOq8OJDcJ3LUI71Jw==*WeNzV21CwM-cyccZ8BQmfNZn3hViOpTMLg1kJQnb0WI=' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
--header 'Accept: */*' \
--header 'Host: api.hitem3d.ai' \
--header 'Connection: keep-alive' \
--header 'Content-Type: multipart/form-data; boundary=--------------------------606514836105993765865977' \
--form 'images=@"/Users/jinyeliu/Desktop/tos_temp/dog.jpeg"' \
--form 'request_type="3"' \
--form 'resolution="512"' \
--form 'face="800000"' \
--form 'mesh_url="https://mm-sparc3d-test.tos-ap-southeast-1.volces.com/jjewelry/web/model3ds/img2model3d/20250724/a483f649a77a4000961e82405bbd4439/target/model/original/0.glb"' \
--form 'model="hitem3dv1"' \
--form 'format="2"' \
--form 'callback_url="http://callback.com"'
```

<!-- chunk_id: list-create-task-chunk-06 -->

### Python-单图生3D-分阶段生成（几何生成）

<!-- chunk_id: list-create-task-chunk-07 -->

```python
import requests

url = "https://api.hitem3d.ai/open-api/v1/submit-task"

headers = {
    "Authorization": "Bearer 6pzBx1a5Cj68XhQe*H07YsrAYSIuSptfihGpHd40QTd3RtfRWy-ao9F12AqYUYdedxmbL0Yl2F8HO9nbhFuIs0hhoaJAd7GUAlgfp2nbHlqTJIBphEHgw_oVAtp9VQtN-mS_uUTwUejcENG4WzwAPtTsJBIZQzGjU_xJzZvnQPPPxaSQaPEBNsekNRFzMLq8us4W3zJJa8P3G0EVnQQ1_jhO6X4ycMBKfqS8GXALZntk-4vkykA4sZxU6edoQEjKGC6oT_dRK3GzevCxI1uvYvwmsNjZYe4G7uDlkNAuny6EdDiBqb3hpf4jETA_mv5ItAJvccd5S91_IJEV0v5uBALrkuD-bDuneLIi2h6-11et4gmAA5_00XgOq8OJDcJ3LUI71Jw==*WeNzV21CwM-cyccZ8BQmfNZn3hViOpTMLg1kJQnb0WI=",
    "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
    "Accept": "*/*",
    "Host": "api.hitem3d.ai",
    "Connection": "keep-alive"
}

files = {
    "images": ("glove_1.jpg", open("/Users/jinyeliu/Desktop/tos_temp/glove_1.jpg", "rb"), "image/jpeg")
}

data = {
    "request_type": "1",
    "resolution": "512",
    "face": "800000",
    "model": "hitem3dv1",
    "format": "2",
    "callback_url": "http://callback.com"
}

try:
    response = requests.post(
        url=url,
        headers=headers,
        files=files,
        data=data
    )

    print(f"状态码: {response.status_code}")
    print(f"响应内容: {response.text}")

except Exception as e:
    print(f"请求失败: {e}")
```

<!-- chunk_id: list-create-task-chunk-08 -->

### Python-单图生3D-分阶段生成（纹理生成）（需提供mesh_url）

<!-- chunk_id: list-create-task-chunk-09 -->

```python
import requests

url = "https://api.hitem3d.ai/open-api/v1/submit-task"

headers = {
    "Authorization": "Bearer 6pzBx1a5Cj68XhQe*H07YsrAYSIuSptfihGpHd40QTd3RtfRWy-ao9F12AqYUYdedxmbL0Yl2F8HO9nbhFuIs0hhoaJAd7GUAlgfp2nbHlqTJIBphEHgw_oVAtp9VQtN-mS_uUTwUejcENG4WzwAPtTsJBIZQzGjU_xJzZvnQPPPxaSQaPEBNsekNRFzMLq8us4W3zJJa8P3G0EVnQQ1_jhO6X4ycMBKfqS8GXALZntk-4vkykA4sZxU6edoQEjKGC6oT_dRK3GzevCxI1uvYvwmsNjZYe4G7uDlkNAuny6EdDiBqb3hpf4jETA_mv5ItAJvccd5S91_IJEV0v5uBALrkuD-bDuneLIi2h6-11et4gmAA5_00XgOq8OJDcJ3LUI71Jw==*WeNzV21CwM-cyccZ8BQmfNZn3hViOpTMLg1kJQnb0WI=",
    "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
    "Accept": "*/*",
    "Host": "api.hitem3d.ai",
    "Connection": "keep-alive"
}

files = {
    "images": ("glove_1.jpg", open("/Users/jinyeliu/Desktop/tos_temp/glove_1.jpg", "rb"), "image/jpeg")
}

data = {
    "request_type": "2",
    "resolution": "512",
    "face": "800000",
    "mesh_url": "https://hitem3dstatic.zaohaowu.net/jjewelry/web/model3ds/img2model3d/20250916/097772b01ec141c9b2f6711e0d98574a/target/model/original/0.glb",
    "model": "hitem3dv1",
    "format": "2",
    "callback_url": "http://callback.com"
}

try:
    response = requests.post(
        url=url,
        headers=headers,
        files=files,
        data=data
    )

    print(f"状态码: {response.status_code}")
    print(f"响应内容: {response.text}")

except Exception as e:
    print(f"请求失败: {e}")
```

<!-- chunk_id: list-create-task-chunk-10 -->

### Python-单图生3D-一次性生成（几何+纹理）

<!-- chunk_id: list-create-task-chunk-11 -->

```python
import requests

url = "https://api.hitem3d.ai/open-api/v1/submit-task"

headers = {
    "Authorization": "Bearer qFESV7ObldDU33ax*3MioO4CMXrhwjgDwtdpfrstSo_A2EccPyXkPcYhGjbUKpTTLI85ppChFMXCcqFjFk9l4Z9FQVn-XFBzksGmGleOJiCrX7z67b322mgbAoUmsMlFPlqNCcyn48lQHemP9iJI5x5WVFQgCJHcPKGewprUOqbTl5en0OUn6IRpxCHl8cRZj_M97N17I_LO46SG-vhfH0aiFeOU3sE-XilqkFVACb6WMjWOj-2s_XnGjfb-Hqq7GDD7JsilHU8pTNJFVhgrYn4LhVnvyRoNspkA7ksV0YmUxjmZt_1fCVvhzU47sSQcR6uZ-s8wxMai3F5E1fsDHyIDSM3dQRjP3OZ8BoC6u6PU3aZpY4isA_wZ21xZgHrMtbir86w==*_PCXp4sohWZh3pRv6Z3ZUtWuANcScv3mz5JLfgsr2Hg=",
    "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
    "Accept": "*/*",
    "Host": "api.hitem3d.ai",
    "Connection": "keep-alive"
}

files = {
    "images": ("glove_1.jpg", open("/Users/jinyeliu/Desktop/tos_temp/glove_1.jpg", "rb"), "image/jpeg")
}

data = {
    "request_type": "3",
    "resolution": "512",
    "face": "800000",
    "model": "hitem3dv1",
    "format": "2",
    "callback_url": "http://callback.com"
}

try:
    response = requests.post(
        url=url,
        headers=headers,
        files=files,
        data=data
    )

    print(f"状态码: {response.status_code}")
    print(f"响应内容: {response.text}")

except Exception as e:
    print(f"请求失败: {e}")
```

<!-- chunk_id: list-create-task-chunk-12 -->

### Python-多视图生3D-分阶段生成（几何生成）

<!-- chunk_id: list-create-task-chunk-13 -->

```python
import requests

url = "https://api.hitem3d.ai/open-api/v1/submit-task"

headers = {
    "Authorization": "Bearer qFESV7ObldDU33ax*3MioO4CMXrhwjgDwtdpfrstSo_A2EccPyXkPcYhGjbUKpTTLI85ppChFMXCcqFjFk9l4Z9FQVn-XFBzksGmGleOJiCrX7z67b322mgbAoUmsMlFPlqNCcyn48lQHemP9iJI5x5WVFQgCJHcPKGewprUOqbTl5en0OUn6IRpxCHl8cRZj_M97N17I_LO46SG-vhfH0aiFeOU3sE-XilqkFVACb6WMjWOj-2s_XnGjfb-Hqq7GDD7JsilHU8pTNJFVhgrYn4LhVnvyRoNspkA7ksV0YmUxjmZt_1fCVvhzU47sSQcR6uZ-s8wxMai3F5E1fsDHyIDSM3dQRjP3OZ8BoC6u6PU3aZpY4isA_wZ21xZgHrMtbir86w==*_PCXp4sohWZh3pRv6Z3ZUtWuANcScv3mz5JLfgsr2Hg=",
    "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
    "Accept": "*/*",
    "Host": "api.hitem3d.ai",
    "Connection": "keep-alive"
}

data = {
    "request_type": "1",
    "resolution": "512",
    "face": "800000",
    "model": "hitem3dv1.5",
    "format": "2",
    "callback_url": "http://callback.com"
}

try:
    # 使用 with 语句确保文件正确关闭
    with open('/Users/jinyeliu/Desktop/tos_temp/monster_1.jpg', 'rb') as f1, \
            open('/Users/jinyeliu/Desktop/tos_temp/monster_2.jpg', 'rb') as f2:

        files = [
            ('multi_images', ('monster_1.jpg', f1, 'image/jpeg')),
            ('multi_images', ('monster_2.jpg', f2, 'image/jpeg'))
        ]

        response = requests.post(
            url=url,
            headers=headers,
            files=files,
            data=data
        )

        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")

except FileNotFoundError as e:
    print(f"文件未找到: {e}")
except Exception as e:
    print(f"请求失败: {e}")
```

<!-- chunk_id: list-create-task-chunk-14 -->

### Python-多视图生3D-分阶段生成（纹理生成）（需提供mesh_url）

<!-- chunk_id: list-create-task-chunk-15 -->

```python
import requests

url = "https://api.hitem3d.ai/open-api/v1/submit-task"

headers = {
    "Authorization": "Bearer qFESV7ObldDU33ax*3MioO4CMXrhwjgDwtdpfrstSo_A2EccPyXkPcYhGjbUKpTTLI85ppChFMXCcqFjFk9l4Z9FQVn-XFBzksGmGleOJiCrX7z67b322mgbAoUmsMlFPlqNCcyn48lQHemP9iJI5x5WVFQgCJHcPKGewprUOqbTl5en0OUn6IRpxCHl8cRZj_M97N17I_LO46SG-vhfH0aiFeOU3sE-XilqkFVACb6WMjWOj-2s_XnGjfb-Hqq7GDD7JsilHU8pTNJFVhgrYn4LhVnvyRoNspkA7ksV0YmUxjmZt_1fCVvhzU47sSQcR6uZ-s8wxMai3F5E1fsDHyIDSM3dQRjP3OZ8BoC6u6PU3aZpY4isA_wZ21xZgHrMtbir86w==*_PCXp4sohWZh3pRv6Z3ZUtWuANcScv3mz5JLfgsr2Hg=",
    "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
    "Accept": "*/*",
    "Host": "api.hitem3d.ai",
    "Connection": "keep-alive"
}

data = {
    "request_type": "2",
    "resolution": "512",
    "face": "800000",
    "mesh_url": "https://hitem3dstatic.zaohaowu.net/jjewelry/web/model3ds/img2model3d/20251016/337723bee83245c59b376cd4d5e1d6a2/target/model/original/0.glb",
    "model": "hitem3dv1.5",
    "format": "2",
    "callback_url": "http://callback.com"
}

try:
    # 使用 with 语句确保文件正确关闭
    with open('/Users/jinyeliu/Desktop/tos_temp/monster_1.jpg', 'rb') as f1, \
            open('/Users/dongshihao/Desktop/tos_temp/monster_2.jpg', 'rb') as f2:

        files = [
            ('multi_images', ('monster_1.jpg', f1, 'image/jpeg')),
            ('multi_images', ('monster_2.jpg', f2, 'image/jpeg'))
        ]

        response = requests.post(
            url=url,
            headers=headers,
            files=files,
            data=data
        )

        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")

except FileNotFoundError as e:
    print(f"文件未找到: {e}")
except Exception as e:
    print(f"请求失败: {e}")
```

<!-- chunk_id: list-create-task-chunk-16 -->

### Python-多视图生3D-一次性生成（几何+纹理）

<!-- chunk_id: list-create-task-chunk-17 -->

```python
import requests

url = "https://api.hitem3d.ai/open-api/v1/submit-task"

headers = {
    "Authorization": "Bearer B6rqpUHM0aC_zt2m*Omp8grug1HuXkiFNXN1fBQURFdI8z0KSIb6npYnstS6hOjP6o_1mqVpo1qTTWjDodT4fIq8FpAxEmH_8BvjgmWiMzQztILzk3WJ9_jj3oGC-tCSxa-KsDhUAIipvp5OARw5roxwuDknrb2HqxcTlT9Fh4NJFBj9p-UCjrUVee9aCJjJ3B4u3IHn-ZyoXmqKZ_eDMdXiZ71XTxnQWT35nXwAIocjdg4QeP_kQWl2hBR4lyRKo4vvNJslVdhJF6o-pjuCMUfBxLrSbU8LmEFDtRbg88uSV3WoSXtZ3TWKH5auO6F1lgjwKRiwJ39BGKqwTaKnhsx8BLgMTji1yFK3DSg6kpwr7FKnAqiVl0OvjCDlgrT7xxbigJA==*zbm80LORI5z3xnMcthDnZuTyVL8lwvoT8gDIYWRSRsk=",
    "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
    "Accept": "*/*",
    "Host": "api.hitem3d.ai",
    "Connection": "keep-alive"
}

data = {
    "request_type": "3",
    "resolution": "512",
    "face": "800000",
    "model": "hitem3dv1.5",
    "format": "2",
    "callback_url": "http://callback.com"
}

try:
    # 使用 with 语句确保文件正确关闭
    with open('/Users/jinyeliu/Desktop/tos_temp/monster_1.jpg', 'rb') as f1, \
            open('/Users/jinyeliu/Desktop/tos_temp/monster_2.jpg', 'rb') as f2:

        files = [
            ('multi_images', ('monster_1.jpg', f1, 'image/jpeg')),
            ('multi_images', ('monster_2.jpg', f2, 'image/jpeg'))
        ]

        response = requests.post(
            url=url,
            headers=headers,
            files=files,
            data=data
        )

        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")

except FileNotFoundError as e:
    print(f"文件未找到: {e}")
except Exception as e:
    print(f"请求失败: {e}")
```
