from utlis import print_msg
from utlis.third_party_sdk import ThirdPartySdk
import frida
import pandas as pd


def get_device_info():
    devices = frida.enumerate_devices()
    # devices = list(filter(lambda d: d.name != "Local System" and d.name != "Local Socket",
    #                       frida.enumerate_devices()))
    devices_num = len(devices)
    print("读取到 {num} 个设备：".format(num=devices_num))
    devices_data = []
    # if devices_num != 0:
    for device in devices:
        devices_data.append({
            "id": device.id,
            "type": device.type,
            "name": device.name
        })
    devices_data_frame = pd.DataFrame(devices_data, columns=["id", "type", "name"])
    if len(devices_data_frame) != 0:
        print(devices_data_frame)
    else:
        print("无设备连接")
    print()

    result = {}
    try:
        try:
            tps = ThirdPartySdk()
            device = frida.get_usb_device()
            result["thirdPartySdk"] = tps
        except:
            device = frida.get_remote_device()
        print("[*] 当前设备 id: " + device.id)
        result["device"] = device
        return result
    except Exception as e:
        print_msg("hook error")
        print_msg(e)
        exit()
