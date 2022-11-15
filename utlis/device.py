from utlis.third_party_sdk import ThirdPartySdk
from utlis import print_msg
from sys import exit
import subprocess
import frida
import json


class Device:
    def __init__(self, _id: str, _name: str = "unknown", _type: str = "unknown"):
        self.id = _id
        self.name = _name
        self.type = _type

    def __repr__(self) -> str:
        return "Device({})".format(json.dumps(self.__dict__))


def check_environment(device_id):
    """检查设备环境

    :param device_id: 设备ID
    :return:
    """
    device_id_cmd = "-s {}".format(device_id) if device_id is not None else ""
    abi = subprocess.getoutput("adb {} shell getprop ro.product.cpu.abi".format(device_id_cmd))
    if 'device' in abi and 'not found' in abi:
        print_msg('设备ID不存在，请检查')
        exit()
    print_msg('使用 {} 设备'.format(device_id))
    print_msg("设备架构: " + abi)


def enumerate_adb_devices():
    """ 枚举adb设备 """

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
        device = Device(_id=_id, _type=_type, _name="{} {}".format(brand, model))
        devices.append(device)
    return devices


def select_device(device_id):
    """选择设备

    :param device_id: 设备id
    :return:
    """

    if device_id is None:
        devices = list(filter(lambda d: not d.name.lower().startswith("local"), frida.enumerate_devices()))
        devices_num = len(devices)
        print_msg("读取到 {num} 个设备：".format(num=devices_num))
        devices_data = []
        for device in devices:
            devices_data.append({
                "Id": device.id,
                "Type": device.type,
                "Name": device.name
            })
        if devices_data:
            table_titles = ["ID", "Type", "Name"]
            format_string = "{:<20}{:<10}{:<15}"
            print(format_string.format(*table_titles))
            for entry in devices_data:
                print(format_string.format(*entry.values()))
        else:
            print_msg("无设备连接，请退出检查")
            exit()
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
        print_msg("检测到连接指定设备 id: " + device_id)
        device = Device(device_id)
        print()
    return device


def get_frida_device(device_id=None):
    """ 设备初始化 """
    result = {}
    try:
        print_msg("设备环境检测中...")
        device_selection = select_device(device_id)
        if device_selection is None:
            try:
                device = frida.get_usb_device(1)
            except:
                print_msg('\n获取USB设备失败，使用remote模式...')
                device = frida.get_remote_device()
        else:
            check_environment(device_selection.id)
            device = frida.get_device(device_selection.id, 1)

        result["device"] = device
        result["thirdPartySdk"] = ThirdPartySdk()
        print_msg("Frida bindings 版本: {}".format(frida.__version__))
        return result
    except Exception as e:
        print_msg("环境初始化失败，请检查是否正确安装Frida！\n")
        print_msg(e)
        exit()
