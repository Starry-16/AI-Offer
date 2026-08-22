"""内置企业库种子数据与岗位匹配关键词。

companies 集合字段：
- name: 公司名称
- category: 企业分类（互联网 / 科技 / 银行 / 券商基金 / 保险 / 金融科技）
- positions: 岗位分类列表（算法/开发/测试/数据/产品/运营/设计/金融/职能）
- url: 校招投递链接
"""

# 岗位分类的规范列表（前端筛选、匹配打分共用）
POSITION_TYPES = ["算法", "开发", "测试", "数据", "产品", "运营", "设计", "金融", "职能"]

COMPANY_SEED = [
    # ================= 互联网 =================
    {"name": "腾讯", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营", "设计"], "url": "https://join.qq.com"},
    {"name": "阿里巴巴", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营", "设计"], "url": "https://campus.alibaba.com"},
    {"name": "字节跳动", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营", "设计"], "url": "https://jobs.bytedance.com/campus"},
    {"name": "美团", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营"], "url": "https://zhaopin.meituan.com/web/campus"},
    {"name": "京东", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营", "职能"], "url": "https://campus.jd.com"},
    {"name": "百度", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品"], "url": "https://talent.baidu.com/campus"},
    {"name": "网易", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营", "设计"], "url": "https://campus.163.com"},
    {"name": "拼多多", "category": "互联网", "positions": ["算法", "开发", "数据", "产品", "运营"], "url": "https://careers.pinduoduo.com/campus"},
    {"name": "快手", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营"], "url": "https://campus.kuaishou.cn"},
    {"name": "哔哩哔哩", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营", "设计"], "url": "https://jobs.bilibili.com/campus"},
    {"name": "小红书", "category": "互联网", "positions": ["算法", "开发", "数据", "产品", "运营"], "url": "https://job.xiaohongshu.com/campus"},
    {"name": "滴滴", "category": "互联网", "positions": ["算法", "开发", "数据", "产品", "运营"], "url": "https://campus.didiglobal.com"},
    {"name": "携程", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营"], "url": "https://careers.ctrip.com/campus"},
    {"name": "爱奇艺", "category": "互联网", "positions": ["算法", "开发", "数据", "产品", "运营"], "url": "https://careers.iqiyi.com"},
    {"name": "360集团", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品"], "url": "https://campus.360.cn"},
    {"name": "新浪微博", "category": "互联网", "positions": ["开发", "数据", "产品", "运营"], "url": "https://career.sina.com.cn"},
    {"name": "知乎", "category": "互联网", "positions": ["算法", "开发", "数据", "产品", "运营"], "url": "https://zhihu.jobs.feishu.cn/index"},
    {"name": "得物", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营"], "url": "https://poizon.jobs.feishu.cn/index"},
    {"name": "Shopee", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品"], "url": "https://careers.shopee.cn/campus"},
    {"name": "SHEIN", "category": "互联网", "positions": ["算法", "开发", "数据", "产品", "运营"], "url": "https://careers.shein.com/campus"},
    {"name": "米哈游", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品", "运营", "设计"], "url": "https://campus.mihoyo.com"},
    {"name": "莉莉丝游戏", "category": "互联网", "positions": ["开发", "数据", "产品", "设计"], "url": "https://lilithgames.jobs.feishu.cn/index"},
    {"name": "顺丰科技", "category": "互联网", "positions": ["算法", "开发", "测试", "数据", "产品"], "url": "https://campus.sf-express.com"},
    {"name": "微软", "category": "互联网", "positions": ["算法", "开发", "数据"], "url": "https://careers.microsoft.com/v2/global/en/students"},
    {"name": "亚马逊", "category": "互联网", "positions": ["算法", "开发", "数据"], "url": "https://www.amazon.jobs/zh"},
    {"name": "特斯拉", "category": "科技", "positions": ["算法", "开发", "数据"], "url": "https://www.tesla.cn/careers"},

    # ================= 科技 / 硬件 =================
    {"name": "华为", "category": "科技", "positions": ["算法", "开发", "测试", "数据", "产品"], "url": "https://career.huawei.com"},
    {"name": "小米", "category": "科技", "positions": ["算法", "开发", "测试", "数据", "产品", "设计"], "url": "https://hr.xiaomi.com/campus"},
    {"name": "OPPO", "category": "科技", "positions": ["算法", "开发", "测试", "产品"], "url": "https://careers.oppo.com/campus"},
    {"name": "vivo", "category": "科技", "positions": ["算法", "开发", "测试", "产品"], "url": "https://hr.vivo.com/campus"},
    {"name": "荣耀", "category": "科技", "positions": ["算法", "开发", "测试", "产品"], "url": "https://career.honor.com"},
    {"name": "中兴通讯", "category": "科技", "positions": ["算法", "开发", "测试"], "url": "https://job.zte.com.cn/campus"},
    {"name": "联想", "category": "科技", "positions": ["算法", "开发", "测试", "产品"], "url": "https://jobs.lenovo.com"},
    {"name": "大疆", "category": "科技", "positions": ["算法", "开发", "测试", "产品"], "url": "https://we.dji.com/zh-CN/campus"},
    {"name": "海康威视", "category": "科技", "positions": ["算法", "开发", "测试", "数据", "产品"], "url": "https://hikvision.zhiye.com/campus"},
    {"name": "科大讯飞", "category": "科技", "positions": ["算法", "开发", "测试", "数据", "产品"], "url": "https://campus.iflytek.com"},
    {"name": "商汤科技", "category": "科技", "positions": ["算法", "开发", "数据"], "url": "https://www.sensetime.com/cn/join-index"},
    {"name": "深信服", "category": "科技", "positions": ["开发", "测试", "产品"], "url": "https://hr.sangfor.com"},
    {"name": "金山办公", "category": "科技", "positions": ["算法", "开发", "测试", "产品"], "url": "https://join.wps.cn"},
    {"name": "比亚迪", "category": "科技", "positions": ["算法", "开发", "数据", "职能"], "url": "https://job.byd.com"},
    {"name": "蔚来", "category": "科技", "positions": ["算法", "开发", "数据", "产品"], "url": "https://campus.nio.com"},
    {"name": "小鹏汽车", "category": "科技", "positions": ["算法", "开发", "数据", "产品"], "url": "https://www.xiaopeng.com/join.html"},

    # ================= 银行 =================
    {"name": "中国工商银行", "category": "银行", "positions": ["金融", "开发", "数据", "算法"], "url": "https://job.icbc.com.cn"},
    {"name": "中国建设银行", "category": "银行", "positions": ["金融", "开发", "数据", "算法"], "url": "http://job.ccb.com/cn/job/index.html"},
    {"name": "中国农业银行", "category": "银行", "positions": ["金融", "开发", "数据", "算法"], "url": "https://career.abchina.com"},
    {"name": "中国银行", "category": "银行", "positions": ["金融", "开发", "数据", "算法"], "url": "https://www.bankofchina.com/aboutus/jobs/"},
    {"name": "交通银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://job.bankcomm.com"},
    {"name": "邮储银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://www.psbc.com/cn/gywm/rczp/"},
    {"name": "招商银行", "category": "银行", "positions": ["金融", "开发", "数据", "算法"], "url": "https://career.cmbchina.com"},
    {"name": "浦发银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://job.spdb.com.cn"},
    {"name": "中信银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://job.citicbank.com"},
    {"name": "民生银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://career.cmbc.com.cn"},
    {"name": "兴业银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://www.cib.com.cn/cn/aboutCIB/jobs/"},
    {"name": "光大银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://cebbank.zhiye.com/campus"},
    {"name": "平安银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://campus.pingan.com"},
    {"name": "华夏银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://www.hxb.com.cn/zh/gywm/rczp/"},
    {"name": "广发银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://www.cgbchina.com.cn/gywm/rczp/"},
    {"name": "浙商银行", "category": "银行", "positions": ["金融", "开发", "数据"], "url": "https://zp.czbank.com.cn"},

    # ================= 券商 / 基金 =================
    {"name": "中信证券", "category": "券商基金", "positions": ["金融", "开发", "数据"], "url": "https://careers.citics.com"},
    {"name": "中金公司", "category": "券商基金", "positions": ["金融", "数据"], "url": "https://cicc.zhiye.com/campus"},
    {"name": "华泰证券", "category": "券商基金", "positions": ["金融", "开发", "数据", "算法"], "url": "https://www.htsc.com.cn/about/join_us/"},
    {"name": "国泰君安", "category": "券商基金", "positions": ["金融", "开发", "数据"], "url": "https://gtja.zhiye.com/campus"},
    {"name": "招商证券", "category": "券商基金", "positions": ["金融", "开发", "数据"], "url": "https://www.cmschina.com/hr/"},
    {"name": "广发证券", "category": "券商基金", "positions": ["金融", "开发", "数据"], "url": "https://www.gf.com.cn/job/"},
    {"name": "申万宏源", "category": "券商基金", "positions": ["金融", "开发", "数据"], "url": "https://www.swhysc.com/swhysc/gywm/rczp/"},
    {"name": "易方达基金", "category": "券商基金", "positions": ["金融", "数据"], "url": "https://www.efunds.com.cn/html/main/a12/"},
    {"name": "华夏基金", "category": "券商基金", "positions": ["金融", "数据"], "url": "https://www.chinaamc.com/gywm/rczp/"},
    {"name": "东方财富", "category": "券商基金", "positions": ["金融", "开发", "数据", "算法"], "url": "https://eastmoney.zhiye.com/campus"},
    {"name": "同花顺", "category": "券商基金", "positions": ["算法", "开发", "数据", "金融"], "url": "https://job.10jqka.com.cn"},
    {"name": "恒生电子", "category": "券商基金", "positions": ["开发", "测试", "数据", "金融"], "url": "https://hundsun.zhiye.com/campus"},

    # ================= 保险 / 交易所 =================
    {"name": "中国平安", "category": "保险", "positions": ["金融", "算法", "开发", "数据"], "url": "https://campus.pingan.com"},
    {"name": "中国人寿", "category": "保险", "positions": ["金融", "开发", "数据"], "url": "https://chinalife.zhiye.com/campus"},
    {"name": "中国太保", "category": "保险", "positions": ["金融", "开发", "数据"], "url": "https://www.cpic.com.cn/c/gywm/rczp/"},
    {"name": "上海证券交易所", "category": "金融科技", "positions": ["金融", "开发", "数据"], "url": "https://www.sse.com.cn/aboutus/recruitment/"},
    {"name": "深圳证券交易所", "category": "金融科技", "positions": ["金融", "开发", "数据"], "url": "https://www.szse.cn/aboutus/joinus/"},
    {"name": "中国银联", "category": "金融科技", "positions": ["金融", "开发", "数据"], "url": "https://cn.unionpay.com/UPOWHtml/cn/about/join_us/"},

    # ================= 金融科技 =================
    {"name": "蚂蚁集团", "category": "金融科技", "positions": ["算法", "开发", "数据", "金融", "产品"], "url": "https://talent.antgroup.com/campus"},
    {"name": "京东科技", "category": "金融科技", "positions": ["算法", "开发", "数据", "金融"], "url": "https://campus.jd.com"},
    {"name": "度小满", "category": "金融科技", "positions": ["算法", "开发", "数据", "金融"], "url": "https://duxiaoman.jobs.feishu.cn/index"},
    {"name": "微众银行", "category": "金融科技", "positions": ["算法", "开发", "数据", "金融"], "url": "https://www.webank.com/careers/"},
    {"name": "网商银行", "category": "金融科技", "positions": ["开发", "数据", "金融"], "url": "https://www.mybank.cn/gywm/rczp/"},
    {"name": "陆金所", "category": "金融科技", "positions": ["开发", "数据", "金融"], "url": "https://www.lu.com/gywm/rczp/"},
    {"name": "PayPal", "category": "金融科技", "positions": ["算法", "开发", "数据"], "url": "https://www.paypal.com/c2/webapps/mpp/jobs"},
]

# 岗位匹配关键词（权重体现区分度，命中即累加，最后归一化到 0-100）
POSITION_KEYWORDS = {
    "算法": {
        "机器学习": 10, "深度学习": 10, "大模型": 10, "llm": 10, "nlp": 9, "自然语言": 9,
        "cv": 9, "计算机视觉": 9, "推荐系统": 9, "强化学习": 9, "pytorch": 8, "tensorflow": 8,
        "神经网络": 8, "transformer": 8, "多模态": 8, "aigc": 8, "rag": 8, "模型训练": 8,
        "数据挖掘": 6, "sklearn": 6, "论文": 5, "python": 4, "算法": 6,
    },
    "开发": {
        "java": 9, "go": 8, "golang": 8, "c++": 9, "spring": 8, "mysql": 7, "redis": 7,
        "后端": 8, "前端": 8, "全栈": 8, "vue": 7, "react": 7, "javascript": 7, "typescript": 7,
        "微服务": 8, "分布式": 8, "linux": 6, "docker": 6, "kubernetes": 6, "git": 4,
        "python": 5, "接口": 4, "架构": 6, "中间件": 7, "高并发": 8, "开发": 6,
    },
    "测试": {
        "测试": 10, "自动化测试": 10, "selenium": 9, "jmeter": 9, "压测": 8, "性能测试": 9,
        "功能测试": 9, "测试用例": 9, "接口测试": 9, "pytest": 8, "质量保证": 7, "qa": 7,
        "bug": 5, "postman": 6, "appium": 8,
    },
    "数据": {
        "数据分析": 10, "数据科学": 10, "sql": 8, "hive": 8, "spark": 8, "hadoop": 8,
        "flink": 8, "数据仓库": 9, "数仓": 9, "etl": 9, "bi": 7, "tableau": 7, "excel": 5,
        "统计学": 7, "数据可视化": 8, "用户画像": 7, "ab实验": 7, "a/b": 7, "埋点": 7,
        "python": 4, "pandas": 7,
    },
    "产品": {
        "产品经理": 10, "prd": 9, "需求分析": 9, "原型": 8, "axure": 8, "figma": 6,
        "用户调研": 8, "竞品分析": 8, "产品": 7, "增长": 6, "mvp": 6, "roadmap": 6,
        "交互设计": 6, "数据分析": 4, "项目管理": 5,
    },
    "运营": {
        "运营": 10, "用户运营": 10, "内容运营": 10, "活动策划": 9, "增长": 8, "留存": 8,
        "转化": 7, "社群": 7, "新媒体": 8, "私域": 7, "拉新": 8, "文案": 6, "复盘": 5,
        "数据分析": 4, "excel": 4,
    },
    "设计": {
        "设计": 8, "ui": 9, "ux": 9, "交互": 9, "视觉设计": 10, "figma": 9, "sketch": 8,
        "photoshop": 8, "ps": 5, "插画": 8, "动效": 8, "blender": 7, "c4d": 7, "作品集": 8,
        "平面设计": 9,
    },
    "金融": {
        "金融": 9, "证券": 9, "基金": 9, "银行": 8, "投资": 8, "投行": 9, "行研": 9,
        "研究部": 8, "资管": 9, "风控": 9, "财务": 7, "会计": 7, "审计": 7, "cfa": 10,
        "frm": 10, "cpa": 9, "估值": 8, "宏观经济": 7, "量化": 9, "衍生品": 8, "固收": 8,
        "经济学": 6, "财报": 7,
    },
    "职能": {
        "人力资源": 9, "hr": 8, "行政": 8, "法务": 9, "财务": 7, "供应链": 8, "采购": 8,
        "项目管理": 7, "市场": 7, "品牌": 7, "公关": 8, "客户成功": 7, "销售": 7,
    },
}
