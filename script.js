// 绕过TracerPid检测
var ByPassTracerPid = function () {
    var fgetsPtr = Module.findExportByName('libc.so', 'fgets');
    var fgets = new NativeFunction(fgetsPtr, 'pointer', ['pointer', 'int', 'pointer']);
    Interceptor.replace(fgetsPtr, new NativeCallback(function (buffer, size, fp) {
        var retval = fgets(buffer, size, fp);
        var bufstr = Memory.readUtf8String(buffer);
        if (bufstr.indexOf('TracerPid:') > -1) {
            Memory.writeUtf8String(buffer, 'TracerPid:\t0');
            console.log('tracerpid replaced: ' + Memory.readUtf8String(buffer));
        }
        return retval;
    }, 'pointer', ['pointer', 'int', 'pointer']));
};

// 获取调用链
function getStackTrace() {
    var Exception = Java.use('java.lang.Exception');
    var ins = Exception.$new('Exception');
    var straces = ins.getStackTrace();
    if (undefined == straces || null == straces) {
        return;
    }
    var result = '';
    for (var i = 0; i < straces.length; i++) {
        var str = '   ' + straces[i].toString();
        result += str + '\r\n';
    }
    Exception.$dispose();
    return result;
}

function get_format_time() {
    var myDate = new Date();

    return myDate.getFullYear() + '-' + myDate.getMonth() + '-' + myDate.getDate() + ' ' + myDate.getHours() + ':' + myDate.getMinutes() + ':' + myDate.getSeconds();
}

//告警发送
function alertSend(action, messages, arg) {
    var _time = get_format_time();
    send({
        'type': 'notice',
        'time': _time,
        'action': action,
        'messages': messages,
        'arg': arg,
        'stacks': getStackTrace()
    });
}

// 增强健壮性，避免有的设备无法使用 Array.isArray 方法
if (!Array.isArray) {
    Array.isArray = function (arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };
}

// hook方法
function hookMethod(targetClass, targetMethod, targetArgs, action, messages) {
    try {
        var _Class = Java.use(targetClass);
    } catch (e) {
        return false;
    }

    if (targetMethod == '$init') {
        var overloadCount = _Class.$init.overloads.length;
        for (var i = 0; i < overloadCount; i++) {
            _Class.$init.overloads[i].implementation = function () {
                var temp = this.$init.apply(this, arguments);
                // 是否含有需要过滤的参数
                var argumentValues = Object.values(arguments);
                if (Array.isArray(targetArgs) && targetArgs.length > 0 && !targetArgs.every(item => argumentValues.includes(item))) {
                    return null;
                }
                var arg = '';
                for (var j = 0; j < arguments.length; j++) {
                    arg += '参数' + j + '：' + JSON.stringify(arguments[j]) + '\r\n';
                }
                if (arg.length == 0) arg = '无参数';
                else arg = arg.slice(0, arg.length - 1);
                alertSend(action, messages, arg);
                return temp;
            }
        }
    } else {
        try {
            var overloadCount = _Class[targetMethod].overloads.length;
        } catch (e) {
            console.log(e)
            console.log('[*] hook(' + targetMethod + ')方法失败,请检查该方法是否存在！！！');
            return false;
        }
        for (var i = 0; i < overloadCount; i++) {
            _Class[targetMethod].overloads[i].implementation = function () {
                var temp = this[targetMethod].apply(this, arguments);
                // 是否含有需要过滤的参数
                var argumentValues = Object.values(arguments);
                if (Array.isArray(targetArgs) && targetArgs.length > 0 && !targetArgs.every(item => argumentValues.includes(item))) {
                    return null;
                }
                var arg = '';
                for (var j = 0; j < arguments.length; j++) {
                    arg += '参数' + j + '：' + JSON.stringify(arguments[j]) + '\r\n';
                }
                if (arg.length == 0) arg = '无参数';
                else arg = arg.slice(0, arg.length - 1);
                alertSend(action, messages, arg);
                return temp;
            }
        }
    }
    return true;
}

// hook方法(去掉不存在方法）
function hook(targetClass, methodData) {
    try {
        var _Class = Java.use(targetClass);
    } catch (e) {
        return false;
    }
    var methods = _Class.class.getDeclaredMethods();
    _Class.$dispose;
    // 排查掉不存在的方法，用于各个android版本不存在方法报错问题。
    methodData.forEach(function (methodData) {
        for (var i in methods) {
            if (methods[i].toString().indexOf('.' + methodData['methodName'] + '(') != -1 || methodData['methodName'] == '$init') {
                hookMethod(targetClass, methodData['methodName'], methodData['args'], methodData['action'], methodData['messages']);
                break;
            }
        }
    });
}

// hook获取其他app信息api，排除app自身
function hookApplicationPackageManagerExceptSelf(targetMethod, action) {
    var _ApplicationPackageManager = Java.use('android.app.ApplicationPackageManager');
    try {
        try {
            var overloadCount = _ApplicationPackageManager[targetMethod].overloads.length;
        } catch (e) {
            console.log(e)
            console.log('[*] hook(' + targetMethod + ')方法失败,请检查该方法是否存在！！！');
            return false;
        }
        for (var i = 0; i < overloadCount; i++) {
            _ApplicationPackageManager[targetMethod].overloads[i].implementation = function () {
                var temp = this[targetMethod].apply(this, arguments);
                var arg = '';
                for (var j = 0; j < arguments.length; j++) {
                    if (j === 0) {
                        var string_to_recv;
                        send({'type': 'app_name', 'data': arguments[j]});
                        recv(function (received_json_object) {
                            string_to_recv = received_json_object.my_data;
                        }).wait();
                    }
                    arg += '参数' + j + '：' + JSON.stringify(arguments[j]) + '\r\n';
                }
                if (arg.length == 0) arg = '无参数';
                else arg = arg.slice(0, arg.length - 1);
                if (string_to_recv) {
                    alertSend(action, targetMethod + '获取的数据为：' + temp, arg);
                }
                return temp;
            }
        }
    } catch (e) {
        console.log(e);
        return
    }


}

// 申请权限
function checkRequestPermission() {
    var action = '申请权限';

    //老项目
    hook('android.support.v4.app.ActivityCompat', [
        {'methodName': 'requestPermissions', 'action': action, 'messages': '申请具体权限看"参数1"'}
    ]);

    hook('androidx.core.app.ActivityCompat', [
        {'methodName': 'requestPermissions', 'action': action, 'messages': '申请具体权限看"参数1"'}
    ]);
}

// 获取电话相关信息
function getPhoneState() {
    var action = '获取电话相关信息';

    hook('android.telephony.TelephonyManager', [
        // Android 8.0
        {'methodName': 'getDeviceId', 'action': action, 'messages': '获取IMEI'},
        // Android 8.1、9   android 10获取不到
        {'methodName': 'getImei', 'action': action, 'messages': '获取IMEI'},

        {'methodName': 'getMeid', 'action': action, 'messages': '获取MEID'},
        {'methodName': 'getLine1Number', 'action': action, 'messages': '获取电话号码标识符'},
        {'methodName': 'getSimSerialNumber', 'action': action, 'messages': '获取IMSI/iccid'},
        {'methodName': 'getSubscriberId', 'action': action, 'messages': '获取IMSI'},
        {'methodName': 'getSimOperator', 'action': action, 'messages': '获取MCC/MNC'},
        {'methodName': 'getNetworkOperator', 'action': action, 'messages': '获取MCC/MNC'},
        {'methodName': 'getSimCountryIso', 'action': action, 'messages': '获取SIM卡国家代码'},

        {'methodName': 'getCellLocation', 'action': action, 'messages': '获取电话当前位置信息'},
        {'methodName': 'getAllCellInfo', 'action': action, 'messages': '获取电话当前位置信息'},
        {'methodName': 'requestCellInfoUpdate', 'action': action, 'messages': '获取基站信息'},
        {'methodName': 'getServiceState', 'action': action, 'messages': '获取sim卡是否可用'},
    ]);

    // 电信卡cid lac
    hook('android.telephony.cdma.CdmaCellLocation', [
        {'methodName': 'getBaseStationId', 'action': action, 'messages': '获取基站cid信息'},
        {'methodName': 'getNetworkId', 'action': action, 'messages': '获取基站lac信息'}
    ]);

    // 移动联通卡 cid/lac
    hook('android.telephony.gsm.GsmCellLocation', [
        {'methodName': 'getCid', 'action': action, 'messages': '获取基站cid信息'},
        {'methodName': 'getLac', 'action': action, 'messages': '获取基站lac信息'}
    ]);
}

// 系统信息(AndroidId/标识/content敏感信息)
function getSystemData() {
    var action = '获取系统信息';

    hook('android.provider.Settings$Secure', [
        {'methodName': 'getString', 'args': ['android_id'], 'action': action, 'messages': '获取安卓ID'}
    ]);
    hook('android.provider.Settings$System', [
        {'methodName': 'getString', 'args': ['android_id'], 'action': action, 'messages': '获取安卓ID'}
    ]);


    hook('android.os.Build', [
        {'methodName': 'getSerial', 'action': action, 'messages': '获取设备序列号'},
    ]);

    hook('android.app.admin.DevicePolicyManager', [
        {'methodName': 'getWifiMacAddress', 'action': action, 'messages': '获取mac地址'},
    ]);

    hook('android.content.ClipboardManager', [
        {'methodName': 'getPrimaryClip', 'action': action, 'messages': '读取剪切板信息'},
    ]);

    //获取content敏感信息
    try {
        // 通讯录内容
        var ContactsContract = Java.use('android.provider.ContactsContract');
        var contact_authority = ContactsContract.class.getDeclaredField('AUTHORITY').get('java.lang.Object');
    } catch (e) {
        console.log(e)
    }
    try {
        // 日历内容
        var CalendarContract = Java.use('android.provider.CalendarContract');
        var calendar_authority = CalendarContract.class.getDeclaredField('AUTHORITY').get('java.lang.Object');
    } catch (e) {
        console.log(e)
    }
    try {
        // 浏览器内容
        var BrowserContract = Java.use('android.provider.BrowserContract');
        var browser_authority = BrowserContract.class.getDeclaredField('AUTHORITY').get('java.lang.Object');
    } catch (e) {
        console.log(e)
    }
    try {
        // 相册内容
        var MediaStore = Java.use('android.provider.MediaStore');
        var media_authority = MediaStore.class.getDeclaredField('AUTHORITY').get('java.lang.Object');
    } catch (e) {
        console.log(e)
    }
    try {
        var ContentResolver = Java.use('android.content.ContentResolver');
        var queryLength = ContentResolver.query.overloads.length;
        for (var i = 0; i < queryLength; i++) {
            ContentResolver.query.overloads[i].implementation = function () {
                var temp = this.query.apply(this, arguments);
                if (arguments[0].toString().indexOf(contact_authority) != -1) {
                    alertSend(action, '获取手机通信录内容', '');
                } else if (arguments[0].toString().indexOf(calendar_authority) != -1) {
                    alertSend(action, '获取日历内容', '');
                } else if (arguments[0].toString().indexOf(browser_authority) != -1) {
                    alertSend(action, '获取浏览器内容', '');
                } else if (arguments[0].toString().indexOf(media_authority) != -1) {
                    alertSend(action, '获取相册内容', '');
                }
                return temp;
            }
        }
    } catch (e) {
        console.log(e);
        return
    }
}

//获取其他app信息
function getPackageManager() {
    var action = '获取其他app信息';

    hook('android.content.pm.PackageManager', [
        {'methodName': 'getInstalledPackages', 'action': action, 'messages': 'APP获取了其他app信息'},
        {'methodName': 'getInstalledApplications', 'action': action, 'messages': 'APP获取了其他app信息'}
    ]);

    hook('android.app.ApplicationPackageManager', [
        {'methodName': 'getInstalledPackages', 'action': action, 'messages': 'APP获取了其他app信息'},
        {'methodName': 'getInstalledApplications', 'action': action, 'messages': 'APP获取了其他app信息'},
        {'methodName': 'queryIntentActivities', 'action': action, 'messages': 'APP获取了其他app信息'},
    ]);

    hook('android.app.ActivityManager', [
        {'methodName': 'getRunningAppProcesses', 'action': action, 'messages': '获取了正在运行的App'},
        {'methodName': 'getRunningServiceControlPanel', 'action': action, 'messages': '获取了正在运行的服务面板'},
    ]);

    //需排除应用本身
    hookApplicationPackageManagerExceptSelf('getApplicationInfo', action);
    hookApplicationPackageManagerExceptSelf('getPackageInfoAsUser', action);
    hookApplicationPackageManagerExceptSelf('getInstallerPackageName', action);
}

// 获取位置信息
function getGSP() {
    var action = '获取位置信息';

    hook('android.location.LocationManager', [
        {'methodName': 'requestLocationUpdates', 'action': action, 'messages': action},
        {'methodName': 'getLastKnownLocation', 'action': action, 'messages': action},
        {'methodName': 'getBestProvider', 'action': action, 'messages': action},
        {'methodName': 'getGnssHardwareModelName', 'action': action, 'messages': action},
        {'methodName': 'getGnssYearOfHardware', 'action': action, 'messages': action},
        {'methodName': 'getProvider', 'action': action, 'messages': action},
        {'methodName': 'requestSingleUpdate', 'action': action, 'messages': action},
    ]);

    hook('android.location.Location', [
        {'methodName': 'getAccuracy', 'action': action, 'messages': action},
        {'methodName': 'getAltitude', 'action': action, 'messages': action},
        {'methodName': 'getBearing', 'action': action, 'messages': action},
        {'methodName': 'getBearingAccuracyDegrees', 'action': action, 'messages': action},
        {'methodName': 'getElapsedRealtimeNanos', 'action': action, 'messages': action},
        {'methodName': 'getExtras', 'action': action, 'messages': action},
        {'methodName': 'getLatitude', 'action': action, 'messages': action},
        {'methodName': 'getLongitude', 'action': action, 'messages': action},
        {'methodName': 'getProvider', 'action': action, 'messages': action},
        {'methodName': 'getSpeed', 'action': action, 'messages': action},
        {'methodName': 'getSpeedAccuracyMetersPerSecond', 'action': action, 'messages': action},
        {'methodName': 'getTime', 'action': action, 'messages': action},
        {'methodName': 'getVerticalAccuracyMeters', 'action': action, 'messages': action},
    ]);

}

// 调用摄像头(hook，防止静默拍照)
function getCamera() {
    var action = '调用摄像头';

    hook('android.hardware.Camera', [
        {'methodName': 'open', 'action': action, 'messages': action},
    ]);

    hook('android.hardware.camera2.CameraManager', [
        {'methodName': 'openCamera', 'action': action, 'messages': action},
    ]);

    hook('androidx.camera.core.ImageCapture', [
        {'methodName': 'takePicture', 'action': action, 'messages': '调用摄像头拍照'},
    ]);

}

//获取网络信息
function getNetwork() {
    var action = '获取网络信息';

    hook('android.net.wifi.WifiInfo', [
        {'methodName': 'getMacAddress', 'action': action, 'messages': '获取Mac地址'},
        {'methodName': 'getSSID', 'action': action, 'messages': '获取wifi SSID'},
        {'methodName': 'getBSSID', 'action': action, 'messages': '获取wifi BSSID'},
    ]);

    hook('android.net.wifi.WifiManager', [
        {'methodName': 'getConnectionInfo', 'action': action, 'messages': '获取wifi信息'},
        {'methodName': 'getConfiguredNetworks', 'action': action, 'messages': '获取wifi信息'},
        {'methodName': 'getScanResults', 'action': action, 'messages': '获取wifi信息'},
    ]);

    hook('java.net.InetAddress', [
        {'methodName': 'getHostAddress', 'action': action, 'messages': '获取IP地址'}
    ]);

    hook('java.net.NetworkInterface', [
        {'methodName': 'getHardwareAddress', 'action': action, 'messages': '获取Mac地址'}
    ]);

    hook('android.net.NetworkInfo', [
        {'methodName': 'getType', 'action': action, 'messages': '获取网络类型'},
        {'methodName': 'getTypeName', 'action': action, 'messages': '获取网络类型名称'},
        {'methodName': 'getExtraInfo', 'action': action, 'messages': '获取网络名称'},
        {'methodName': 'isAvailable', 'action': action, 'messages': '获取网络是否可用'},
        {'methodName': 'isConnected', 'action': action, 'messages': '获取网络是否连接'}
    ]);

    // ip地址
    try {
        var _WifiInfo = Java.use('android.net.wifi.WifiInfo');
        //获取ip
        _WifiInfo.getIpAddress.implementation = function () {
            var temp = this.getIpAddress();
            var _ip = new Array();
            _ip[0] = (temp >>> 24) >>> 0;
            _ip[1] = ((temp << 8) >>> 24) >>> 0;
            _ip[2] = (temp << 16) >>> 24;
            _ip[3] = (temp << 24) >>> 24;
            var _str = String(_ip[3]) + "." + String(_ip[2]) + "." + String(_ip[1]) + "." + String(_ip[0]);
            alertSend(action, '获取IP地址：' + _str, '');
            return temp;
        }
    } catch (e) {
        console.log(e)
    }
}

//获取蓝牙设备信息
function getBluetooth() {
    var action = '获取蓝牙设备信息';

    hook('android.bluetooth.BluetoothDevice', [
        {'methodName': 'getName', 'action': action, 'messages': '获取蓝牙设备名称'},
        {'methodName': 'getAddress', 'action': action, 'messages': '获取蓝牙设备mac'},
    ]);

    hook('android.bluetooth.BluetoothAdapter', [
        {'methodName': 'getName', 'action': action, 'messages': '获取蓝牙设备名称'}
    ]);
}

//读写文件
function getFileMessage() {
    var action = '文件操作';

    hook('java.io.RandomAccessFile', [
        {'methodName': '$init', 'action': action, 'messages': 'RandomAccessFile写文件'}
    ]);
    hook('java.io.File', [
        {'methodName': 'mkdirs', 'action': action, 'messages': '尝试写入sdcard创建小米市场审核可能不通过'},
        {'methodName': 'mkdir', 'action': action, 'messages': '尝试写入sdcard创建小米市场审核可能不通过'}
    ]);
}

//获取麦克风信息
function getMedia() {
    var action = '获取麦克风'
    hook('android.media.MediaRecorder', [
        {'methodName': 'start', 'action': action, 'messages': '获取麦克风'},
    ]);
    hook('android.media.AudioRecord', [
        {'methodName': 'startRecording', 'action': action, 'messages': '获取麦克风'},
    ]);
}


function customHook() {
    var action = '用户自定义hook';

    //自定义hook函数，可自行添加。格式如下：
    // hook('com.zhengjim.myapplication.HookTest', [
    //     {'methodName': 'getPassword', 'action': action, 'messages': '获取zhengjim密码'},
    //     {'methodName': 'getUser', 'action': action, 'messages': '获取zhengjim用户名'},
    // ]);
}

function useModule(moduleList) {
    var _module = {
        'permission': [checkRequestPermission],
        'phone': [getPhoneState],
        'system': [getSystemData],
        'app': [getPackageManager],
        'location': [getGSP],
        'network': [getNetwork],
        'camera': [getCamera],
        'bluetooth': [getBluetooth],
        'file': [getFileMessage],
        'media': [getMedia],
        'custom': [customHook]
    };
    var _m = Object.keys(_module);
    var tmp_m = []
    if (moduleList['type'] !== 'all') {
        var input_module_data = moduleList['data'].split(',');
        for (i = 0; i < input_module_data.length; i++) {
            if (_m.indexOf(input_module_data[i]) === -1) {
                send({'type': 'noFoundModule', 'data': input_module_data[i]})
            } else {
                tmp_m.push(input_module_data[i])
            }
        }
    }
    switch (moduleList['type']) {
        case 'use':
            _m = tmp_m;
            break;
        case 'nouse':
            for (var i = 0; i < input_module_data.length; i++) {
                for (var j = 0; j < _m.length; j++) {
                    if (_m[j] == input_module_data[i]) {
                        _m.splice(j, 1);
                        j--;
                    }
                }
            }
            break;
    }
    send({'type': 'loadModule', 'data': _m})
    if (_m.length !== 0) {
        for (i = 0; i < _m.length; i++) {
            for (j = 0; j < _module[_m[i]].length; j++) {
                _module[_m[i]][j]();
            }
        }
    }
}

function main() {
    try {
        Java.perform(function () {
            console.log('[*] ' + get_format_time() + ' 隐私合规检测敏感接口开始监控...');
            send({"type": "isHook"})
            console.log('[*] ' + get_format_time() + ' 检测到安卓版本：' + Java.androidVersion);
            var moduleList;
            recv(function (received_json_object) {
                moduleList = received_json_object.use_module;
            }).wait();
            useModule(moduleList);
        });
    } catch (e) {
        console.log(e)
    }
}

// 绕过TracerPid检测 默认关闭，有必要时再自行打开
// setImmediate(ByPassTracerPid);

//在spawn模式下，hook系统API时如javax.crypto.Cipher建议使用setImmediate立即执行，不需要延时
//在spawn模式下，hook应用自己的函数或含壳时，建议使用setTimeout并给出适当的延时(500~5000)

// main();
//setImmediate(main)
// setTimeout(main, 3000);
