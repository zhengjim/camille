import subprocess
import time

from utlis import print_msg
from utlis.third_party_sdk import ThirdPartySdk
import frida
import pandas as pd


def restart_adb(wait_time=1.5):
    # 避免有时候 frida/adb 迷惑行为拿不到所有连接的设备
    print("[*] 正在重启 ADB 服务")
    restart_adb_shells = ["adb kill-server", "adb start-server"]
    try:
        for shell in restart_adb_shells:
            shell_output = subprocess.getoutput(shell)
            if shell_output == "":
                continue
            print(shell_output)
        # 这里要睡眠至少 1.5 秒，不然可能 adb 服务还没完全开启，导致设备列表为空
        time.sleep(wait_time)
        # subprocess.getoutput("adb devices")
        print("[*] 重启 ADB 服务成功")
    except Exception as e:
        print_msg(e)
    print()


def get_device_info(all_devices, device_id):
    restart_adb()
    try:
        result = {}
        if device_id is None:
            if all_devices:
                devices = frida.enumerate_devices()
            else:
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
            if len(devices_data_frame) > 1:
                selection = int(input("检测到有多个设备，请选择你要操作的设备编号："))
                device = devices[selection]
            else:
                try:
                    device = frida.get_usb_device()
                except:
                    device = frida.get_remote_device()
        else:
            print("检测到连接指定设备 id: " + device_id, end="")
            device = frida.get_device(device_id, 1)
            print(", 连接成功！")
            print()

        print("[*] 当前设备 id: " + device.id)
        result["device"] = device
        result["thirdPartySdk"] = ThirdPartySdk()
        return result
    except Exception as e:
        print_msg("hook error")
        print_msg(e)
        exit()
