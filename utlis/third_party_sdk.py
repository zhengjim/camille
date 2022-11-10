from ast import literal_eval
from utlis import print_msg
import sys
import os


# 生成资源文件目录访问路径
def resource_path(relative_path):
    base_path = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(__file__)))
    return os.path.abspath(os.path.join(base_path, relative_path))


# 第三方SDK代完善 https://blog.csdn.net/bjz2012/article/details/107172205
class ThirdPartySdk:
    def __init__(self):
        try:
            self.third_party_sdk = self.__load_third_party_sdk()
            self.sdk_list = [s['package_name'] for s in self.third_party_sdk]
        except Exception as e:
            print_msg('加载第三方SDK失败，关闭第三方SDK检测')
            self.third_party_sdk = []
            self.sdk_list = []

    def __load_third_party_sdk(self):
        """ 加载第三方sdk规则 """
        result = []
        try:
            sdk_path = os.path.join(os.getcwd(), 'utlis/sdk.json')
            if not os.path.isfile(sdk_path):
                sdk_path = resource_path('utlis/sdk.json')
            with open(sdk_path, 'r', encoding='utf-8') as f:
                sdk_rule = f.read()
            result = literal_eval(sdk_rule)
        except Exception as e:
            print(e)
            print_msg('加载第三方SDK失败，关闭第三方SDK检测')
        return result

    def get_sdk_name(self, package_name):
        """返回sdk名称

        :param package_name: 包名
        :return:
        """
        sdk_name = ''
        for s in self.third_party_sdk:
            if s['package_name'] == package_name:
                sdk_name = s['sdk_name']
        return sdk_name

    def is_third_party(self, content):
        """判断是否为第三方sdk调用

        :param content: 调用堆栈
        :return: 第三方SDK包名/APP本身
        """
        result = 'APP本身'
        for sdk in self.sdk_list:
            if sdk in content:
                result = self.get_sdk_name(sdk)
        return result
