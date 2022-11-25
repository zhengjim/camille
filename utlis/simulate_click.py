from utlis import print_msg, resource_path
from utlis.device import get_frida_device
import subprocess
import cv2
import os


class SimulateClick:
    def __init__(self, device_id, screen_save_path, path):
        self.device_id = device_id
        self.path = os.path.join(os.getcwd(), path)
        self.screen_save_path = screen_save_path
        self.exit_signal = 0
        self.result = 0  # 0 无需隐私合规、退出、1 继续获取隐私政策、2 同意隐私合规政策

    def screencap(self):
        """ android屏幕截图

        :param path: 存在位置
        :return:
        """

        device_id_cmd = "-s {}".format(self.device_id) if self.device_id is not None else ""
        shells = ['adb {} shell rm {}/camille_screen_tmp.png'.format(device_id_cmd, self.screen_save_path),
                  'adb {} shell screencap -p {}/camille_screen_tmp.png'.format(device_id_cmd, self.screen_save_path),
                  'adb {} pull {}/camille_screen_tmp.png {}'.format(device_id_cmd, self.screen_save_path, self.path),
                  'adb {} shell rm {}/camille_screen_tmp.png'.format(device_id_cmd, self.screen_save_path)]
        try:
            result = 1
            for shell in shells:
                out = subprocess.getoutput(shell)
                if 'Permission denied' in out:
                    result = 0
                    print_msg("获取当前屏幕失败，请检查adb及/data/local/tmp目录是否有权限")
            if result:
                print_msg("获取当前屏幕成功，同意隐私协议请鼠标左键点击对应同意位置。如无隐私协议，继续获取屏幕请按 n, 退出请按 q ")
            else:
                print_msg("关闭同意隐私状态，状态均为同意前，不影响hook！")
        except Exception as e:
            result = 0
            print_msg(e)
            print_msg("关闭同意隐私状态，状态均为同意前，不影响hook！")

        return result

    def touchscreen(self, x, y):
        """ 模拟点击

        :param x: x坐标
        :param y: y坐标
        :return:
        """
        device_id_cmd = "-s {}".format(self.device_id) if self.device_id is not None else ""
        shell = 'adb {} shell input tap {x} {y}'.format(device_id_cmd, x=x, y=y)
        try:
            subprocess.getoutput(shell)
            print("===========================确认同意隐私政策=============================")
        except Exception as e:
            print_msg(e)

    def on_EVENT_LBUTTONDOWN(self, event, x, y, flags, param):
        """ 绑定鼠标点击 """
        if event == cv2.EVENT_LBUTTONDOWN:
            self.touchscreen(x, y)
            self.result = 2
            self.exit_signal = 1

    def run(self):
        """ 运行 """
        screencap_result = self.screencap()
        # 成功
        if screencap_result:
            if not os.path.isfile(self.path):
                self.path = resource_path(self.path)
            img = cv2.imread(self.path)
            winname = "ANDROID PHONE"
            cv2.namedWindow(winname, 0)
            # img = cvv2.resize(img, (new_w, new_h))
            cv2.setMouseCallback(winname, self.on_EVENT_LBUTTONDOWN)
            while True:
                cv2.imshow(winname, img)
                # 按q退出
                key = cv2.waitKey(5) & 0xFF
                if key == ord('q'):
                    print_msg('无需同意隐私协议...')
                    break
                if key == ord('n'):
                    self.result = 1
                    break
                if self.exit_signal == 1:
                    break
            cv2.destroyAllWindows()

        return screencap_result

    def get_result(self):
        """ 获取返回结果 """
        return self.result


if __name__ == '__main__':
    sc = SimulateClick(get_frida_device()["device"].id, '/data/local/tmp', 'screen.png')
    sc.run()
