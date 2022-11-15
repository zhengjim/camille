import json
import subprocess
import time

from utlis import print_msg
from utlis.third_party_sdk import ThirdPartySdk
import frida
import pandas as pd


class Device:
    def __init__(self, _id: str, _name: str = "unknown", _type: str = "unknown"):
        self.id = _id
        self.name = _name
        self.type = _type

    def __repr__(self) -> str:
        return "Device({})".format(json.dumps(self.__dict__))


def check_environment(device_id):
    print("[*] 设备环境检测中...")
    print("Frida bindings 版本: {}".format(frida.__version__))
    device_id_cmd = "-s {}".format(device_id) if device_id is not None else ""
    abi = subprocess.getoutput("adb {} shell getprop ro.product.cpu.abi".format(device_id_cmd))
    print("设备架构: " + abi)
    device_frida_status = subprocess.getoutput("adb {} shell \"su -c ps | grep 'frida'\"".format(device_id_cmd))
    is_device_frida_available = True \
        if device_frida_status != "" and "root" in device_frida_status and "frida" in device_frida_status \
        else False
    device_frida_status = "正常" if is_device_frida_available \
        else "检测失败，请检查设备是否已正常安装并运行，注意版本必须与 bindings 一致（程序正常运行请忽略该警告~）"
    print("Frida Server 状态: " + device_frida_status)
    print()


def restart_adb(wait_time=1.5):
    # 避免有时候 frida/adb 迷惑行为拿不到所有连接的设备，比如本机 adb 和模拟器 adb 版本不一致时极容易导致这个情况
    restart_adb_shells = ["adb kill-server", "adb start-server"]
    try:
        for shell in restart_adb_shells:
            subprocess.getoutput(shell)
        # 这里要延时至少 1.5 秒（adb devices 要 3 秒），不然可能 adb 服务还没完全开启，导致设备列表为空
        time.sleep(wait_time)
        # 不知道为啥这里要执行一次 adb devices 后面才能拿到设备
        subprocess.getoutput("adb devices")
        # 这里还要再延时一次，不然设备也会找不全，原因暂时不知
        time.sleep(wait_time)
    except Exception as e:
        print_msg(e)


def enumerate_adb_devices():
    adb_devices = subprocess.getoutput("adb devices").splitlines()
    # 修复因索引不正确导致读取设备列表错误的问题
    adb_devices_index = adb_devices.index('List of devices attached') + 1
    for i in range(adb_devices_index):
        del adb_devices[0]
    devices = []
    for adb_device in adb_devices:
        values = adb_device.split("\t")
        _id = values[0]
        _type = values[1]
        brand = subprocess.getoutput("adb -s {} shell getprop ro.product.brand".format(_id))
        model = subprocess.getoutput("adb -s {} shell getprop ro.product.model".format(_id))
        # android_version = subprocess.getoutput("adb -s {} shell getprop ro.build.version.release".format(_id))
        device = Device(_id=_id, _type=_type, _name="{} {}".format(brand, model))
        devices.append(device)
    return devices


def prepare(device_id, is_restart_adb=False):
    if is_restart_adb:
        print("[*] 正在重启 ADB...", end="")
        restart_adb()
        print("成功！")
    device_selection = select_device(device_id)
    check_environment(device_selection.id)
    return device_selection


def select_device(device_id):
    if device_id is None:
        devices = list(filter(lambda d: not d.name.lower().startswith("local"), frida.enumerate_devices()))
        devices_num = len(devices)
        print("读取到 {num} 个设备：".format(num=devices_num))
        devices_data = []
        # if devices_num != 0:
        for device in devices:
            devices_data.append({
                "Id": device.id,
                "Type": device.type,
                "Name": device.name
            })
        devices_data_frame = pd.DataFrame(devices_data, columns=["Id", "Type", "Name"])
        if len(devices_data_frame) != 0:
            print(devices_data_frame)
        else:
            print("无设备连接")
        print()
        if devices_num > 1:
            selection = int(input("检测到有多个设备，请选择你要操作的设备编号："))
            device = devices[selection]
            print()
        elif devices_num == 1:
            device = devices[0]
        else:
            device = None
    else:
        print("检测到连接指定设备 id: " + device_id)
        device = Device(device_id)
        print()
    return device


def get_frida_device(device_id=None, is_restart_adb=False):
    """ 设备初始化 """
    try:
        result = {}
        device_selection = prepare(device_id, is_restart_adb)
        try:
            print("正在连接设备...", end="")
            if device_selection is None:
                try:
                    device = frida.get_usb_device(1)
                except:
                    print_msg('\n获取USB设备失败，使用remote模式...')
                    device = frida.get_remote_device()
                if device is not None:
                    print("连接成功！\n")
            else:
                device = frida.get_device(device_selection.id, 1)
                if device is not None:
                    print("连接成功！\n")
            result["device"] = device
            result["thirdPartySdk"] = ThirdPartySdk()
            return result
        except Exception as e:
            print("连接失败！\n")
            raise e
    except Exception as e:
        print_msg("环境初始化失败，请检查是否正确安装Frida")
        print_msg(e)
        exit()
