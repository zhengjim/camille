from ast import literal_eval
from utlis import print_msg


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
            with open('utlis/sdk.json', 'r', encoding='utf-8') as f:
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
