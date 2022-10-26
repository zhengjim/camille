import frida
import sys
import time
import argparse
import signal
import os
import xlwt
import random

try:
    import click
except:
    class click:
        @staticmethod
        def secho(message=None, **kwargs):
            print(message)

        @staticmethod
        def style(**kwargs):
            raise Exception("unsupported style")
try:
    from shutil import get_terminal_size as get_terminal_size
except:
    try:
        from backports.shutil_get_terminal_size import get_terminal_size as get_terminal_size
    except:
        pass

banner = """
-----------------------------------------------------------


 .o88b.  .d8b.  .88b  d88. d888888b db      db      d88888b 
d8P  Y8 d8' `8b 88'YbdP`88   `88'   88      88      88'     
8P      88ooo88 88  88  88    88    88      88      88ooooo 
8b      88~~~88 88  88  88    88    88      88      88~~~~~ 
Y8b  d8 88   88 88  88  88   .88.   88booo. 88booo. 88.     
 `Y88P' YP   YP YP  YP  YP Y888888P Y88888P Y88888P Y88888P 
                                                                                     
            https://github.com/zhengjim/camille
-------------------------------------------------------------\n
"""


def show_banner():
    colors = ['bright_red', 'bright_green', 'bright_blue', 'cyan', 'magenta']
    try:
        click.style('color test', fg='bright_red')
    except:
        colors = ['red', 'green', 'blue', 'cyan', 'magenta']
    try:
        columns = get_terminal_size().columns
        if columns >= len(banner.splitlines()[1]):
            for line in banner.splitlines():
                click.secho(line, fg=random.choice(colors))
    except:
        pass


def frida_hook(app_name, use_module, wait_time=0, is_show=True, execl_file=None, isattach=False, external_script=None):
    """
    :param app_name: 包名
    :param use_module 使用哪些模块
    :param wait_time: 延迟hook，避免加壳
    :param is_show: 是否实时显示告警
    :param execl_file 导出文件
    :param isattach 使用attach hook
    :param external_script 加载外部脚本文件

    :return:
    """

    # 消息处理
    def my_message_handler(message, payload):
        if message["type"] == "error":
            print(message)
            os.kill(os.getpid(), signal.SIGTERM)
            return
        if message['type'] == 'send':
            data = message["payload"]
            if data["type"] == "notice":
                alert_time = data['time']
                action = data['action']
                arg = data['arg']
                messages = data['messages']
                stacks = data['stacks']
                if is_show:
                    print("------------------------------start---------------------------------")
                    print("[*] {0}，APP行为：{1}、行为描述：{2}、传入参数：{3}".format(
                        alert_time, action, messages, arg.replace('\r\n', '，')))
                    print("[*] 调用堆栈：")
                    print(stacks)
                    print("-------------------------------end----------------------------------")
                if execl_file:
                    global index_row
                    worksheet.write(index_row, 0, alert_time, content_style)
                    worksheet.write(index_row, 1, action, content_style)
                    worksheet.write(index_row, 2, messages, content_style)
                    worksheet.write(index_row, 3, arg, content_style)
                    worksheet.write(index_row, 4, stacks, content_style)
                    index_row += 1
            if data['type'] == "app_name":
                get_app_name = data['data']
                my_data = False if get_app_name == app_name else True
                script.post({"my_data": my_data})
            if data['type'] == "isHook":
                global isHook
                isHook = True
                script.post({"use_module": use_module})
            if data['type'] == "noFoundModule":
                print('[*] Not Found Module: ' + data['data'] + " . Please exit the check")
                session.detach()

    try:
        try:
            device = frida.get_usb_device()
        except:
            device = frida.get_remote_device()
        pid = app_name if isattach else device.spawn([app_name])
    except Exception as e:
        print("[*] hook error")
        print(e)
        exit()

    time.sleep(1)
    session = device.attach(pid)
    time.sleep(1)

    if execl_file:
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
        worksheet.write(0, 0, '时间点', title_style)
        worksheet.col(0).width = 20 * 300
        worksheet.row(0).height_mismatch = True
        worksheet.row(0).height = 20 * 25
        worksheet.write(0, 1, '操作行为', title_style)
        worksheet.col(1).width = 20 * 300
        worksheet.write(0, 2, '行为描述', title_style)
        worksheet.col(2).width = 20 * 400
        worksheet.write(0, 3, '传入参数', title_style)
        worksheet.col(3).width = 20 * 400
        worksheet.write(0, 4, '调用堆栈', title_style)
        worksheet.col(4).width = 20 * 1200

        content_style = xlwt.XFStyle()
        content_font = xlwt.Font()
        content_font.height = 20 * 11
        content_style.font = content_font
        content_style.alignment = alignment
        content_style.alignment.wrap = 1

    if external_script is not None:
        if os.path.isabs(external_script):
            external_script = os.path.abspath(external_script)
        else:
            external_script = os.path.join(os.getcwd(), external_script)
    else:
        external_script = os.path.join(os.getcwd(), 'data/script.js')
    script_path = external_script if os.path.isfile(external_script) else './script.js'
    with open(script_path, encoding="utf-8") as f:
        script_read = f.read()

    if wait_time:
        script_read += "setTimeout(main, {0}000);\n".format(str(wait_time))
    else:
        script_read += "setImmediate(main);\n"

    script = session.create_script(script_read)
    script.on("message", my_message_handler)
    script.load()
    time.sleep(1)
    try:
        if not isattach:
            device.resume(pid)
    except Exception as e:
        print("[*] hook error")
        print(e)
        exit()

    wait_time += 1
    time.sleep(wait_time)
    if isHook:
        def stop(signum, frame):
            print('[*] You have stoped hook.')
            session.detach()
            if execl_file:
                workbook.save(execl_file)
            exit()

        signal.signal(signal.SIGINT, stop)
        signal.signal(signal.SIGTERM, stop)
        sys.stdin.read()
    else:
        print("[*] hook fail, try delaying hook, adjusting delay time")


if __name__ == '__main__':
    show_banner()

    parser = argparse.ArgumentParser(description="App privacy compliance testing.")
    parser.add_argument("package", help="APP_NAME or process ID ex: com.test.demo01 、12345")
    parser.add_argument("--time", "-t", default=0, type=int, help="Delayed hook, the number is in seconds ex: 5")
    parser.add_argument("--noshow", "-ns", required=False, action="store_const", default=True, const=False,
                        help="Showing the alert message")
    parser.add_argument("--file", "-f", metavar="<path>", required=False, help="Name of Excel file to write")
    parser.add_argument("--isattach", "-ia", required=False, action="store_const", default=False, const=True,
                        help="use attach hook")

    group = parser.add_mutually_exclusive_group()

    group.add_argument("--use", "-u", required=False,
                       help="Detect the specified module,Multiple modules are separated by ',' ex:phone,permission")
    group.add_argument("--nouse", "-nu", required=False,
                       help="Skip specified module，Multiple modules are separated by ',' ex:phone,permission")
    group.add_argument("--external-script", "-es", required=False,
                       help="load external frida script js, default: ./data/script.js")

    args = parser.parse_args()
    # 全局变量
    isHook = False
    index_row = 1

    use_module = {"type": "all", "data": []}
    if args.use:
        use_module = {"type": "use", "data": args.use}
    if args.nouse:
        use_module = {"type": "nouse", "data": args.nouse}

    process = int(args.package) if args.package.isdigit() else args.package
    frida_hook(process, use_module, args.time, args.noshow, args.file, args.isattach, args.external_script)
