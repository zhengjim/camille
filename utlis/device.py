from utlis import print_msg
from utlis.third_party_sdk import ThirdPartySdk
import frida


def get_device_info():
    """ 设备初始化 """

    result = {}
    tps = ThirdPartySdk()
    result["thirdPartySdk"] = tps
    try:
        try:
            device = frida.get_usb_device()
        except:
            print_msg('获取USB设备失败，使用remote模式')
            device = frida.get_remote_device()
        print_msg("当前设备 id: " + device.id)
        result["device"] = device
        return result
    except Exception as e:
        print_msg("环境初始化失败，请检查是否正确安装Frida")
        print_msg(e)
        exit()
