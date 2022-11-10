import time
import xlwt
import sys
import os


def now():
    """ 获取当前时间 """

    return time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(time.time()))


def print_msg(msg):
    """格式化输出

    :param msg: 文本
    :return:
    """

    print("[*] {now} {msg}".format(now=now(), msg=str(msg)))


def write_xlsx(data, file_name):
    """将结果写入xlsx

    :param data: 调用数据
    :param file_name: 导出文件名
    :return:
    """
    workbook = xlwt.Workbook(encoding='utf-8')
    worksheet = workbook.add_sheet('App_privacy_compliance_testing')
    # 标题字体
    title_style = xlwt.XFStyle()
    title_font = xlwt.Font()
    title_font.bold = True  # 黑体
    title_font.height = 30 * 11
    title_style.font = title_font
    # 对其方式
    alignment = xlwt.Alignment()
    alignment.horz = xlwt.Alignment.HORZ_CENTER
    alignment.vert = xlwt.Alignment.VERT_CENTER
    title_style.alignment = alignment
    # 标题
    worksheet.write(0, 0, '隐私政策状态', title_style)
    worksheet.col(0).width = 20 * 300
    worksheet.write(0, 1, '时间点', title_style)
    worksheet.col(1).width = 20 * 300
    worksheet.row(1).height_mismatch = True
    worksheet.row(1).height = 20 * 25
    worksheet.write(0, 2, '行为主体', title_style)
    worksheet.col(2).width = 20 * 300
    worksheet.write(0, 3, '操作行为', title_style)
    worksheet.col(3).width = 20 * 300
    worksheet.write(0, 4, '行为描述', title_style)
    worksheet.col(4).width = 20 * 400
    worksheet.write(0, 5, '传入参数', title_style)
    worksheet.col(5).width = 20 * 400
    worksheet.write(0, 6, '调用堆栈', title_style)
    worksheet.col(6).width = 20 * 1200

    content_style = xlwt.XFStyle()
    content_font = xlwt.Font()
    content_font.height = 20 * 11
    content_style.font = content_font
    content_style.alignment = alignment
    content_style.alignment.wrap = 1
    for i, ed in enumerate(data):
        index_row = i + 1
        worksheet.write(index_row, 0, ed['privacy_policy_status'], content_style)
        worksheet.write(index_row, 1, ed['alert_time'], content_style)
        worksheet.write(index_row, 2, ed['subject_type'], content_style)
        worksheet.write(index_row, 3, ed['action'], content_style)
        worksheet.write(index_row, 4, ed['messages'], content_style)
        worksheet.write(index_row, 5, ed['arg'], content_style)
        worksheet.write(index_row, 6, ed['stacks'], content_style)
    workbook.save(file_name)


def resource_path(relative_path):
    """ 生成资源文件目录访问路径 """
    base_path = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(__file__)))
    return os.path.abspath(os.path.join(base_path, relative_path))
