// 获取调用链
function getStackTrace() {
    var Exception = Java.use("java.lang.Exception");
    var ins = Exception.$new("Exception");
    var straces = ins.getStackTrace();
    if (undefined == straces || null == straces) {
        return;
    }
    var result = "";
    for (var i = 0; i < straces.length; i++) {
        var str = "   " + straces[i].toString();
        result += str + "\r\n";
    }
    Exception.$dispose();
    return result;
}

//告警发送
function alertSend(action, messages) {
    var myDate = new Date();
    var _time = myDate.getFullYear() + "-" + myDate.getMonth() + "-" + myDate.getDate() + " " + myDate.getHours() + ":" + myDate.getMinutes() + ":" + myDate.getSeconds();
    send({"type": "notice", "time": _time, "action": action, "messages": messages, "stacks": getStackTrace()});
}


// APP申请权限
function checkRequestPermission() {
    var ActivityCompat = Java.use("androidx.core.app.ActivityCompat")

    ActivityCompat.requestPermissions.overload('android.app.Activity', '[Ljava.lang.String;', 'int').implementation = function (p1, p2, p3) {
        var temp = this.requestPermissions(p1, p2, p3);
        alertSend("APP申请权限", "申请权限为: " + p2);
        return temp

    }
}

// APP获取IMEI/IMSI
function getPhoneState() {
    var TelephonyManager = Java.use("android.telephony.TelephonyManager");

    // API level 26 获取单个IMEI的方法
    TelephonyManager.getDeviceId.overload().implementation = function () {
        var temp = this.getDeviceId();
        alertSend("获取IMEI", "获取的IMEI为: " + temp)
        return temp;
    };

    //API level 26 获取多个IMEI的方法
    TelephonyManager.getDeviceId.overload('int').implementation = function (p) {
        var temp = this.getDeviceId(p);
        alertSend("获取IMEI", "获取(" + p + ")的IMEI为: " + temp);
        return temp;
    };

    //API LEVEL26以上的获取单个IMEI方法
    TelephonyManager.getImei.overload().implementation = function () {
        var temp = this.getImei();
        alertSend("获取IMEI", "获取的IMEI为: " + temp)
        return temp;
    };

    // API LEVEL26以上的获取多个IMEI方法
    TelephonyManager.getImei.overload('int').implementation = function (p) {
        var temp = this.getImei(p);
        alertSend("获取IMEI", "获取(" + p + ")的IMEI为: " + temp);
        return temp;
    };

    //imsi
    TelephonyManager.getSimSerialNumber.overload().implementation = function () {
        var temp = this.getSimSerialNumber();
        alertSend("获取IMSI", "获取IMSI为(String): " + temp);
        return temp;
    };

    //imsi
    TelephonyManager.getSubscriberId.overload().implementation = function () {
        var temp = this.getSubscriberId();
        alertSend("获取IMSI", "获取IMSI为(int): " + temp);
        return temp;
    }

    // //imsi
    TelephonyManager.getSimSerialNumber.overload('int').implementation = function (p) {
        var temp = this.getSimSerialNumber(p);
        alertSend("获取IMSI", "参数为：(" + p + "), 获取IMSI为(int): " + temp);
        return temp;
    };
}

// 获取Mac地址
function getMacAddress() {
    var WifiInfo = Java.use("android.net.wifi.WifiInfo");
    WifiInfo.getMacAddress.implementation = function () {
        var temp = this.getMacAddress();
        alertSend("获取Mac地址", "获取到的Mac地址: " + temp)
        return temp;
    };


    var NetworkInterface = Java.use("java.net.NetworkInterface");
    NetworkInterface.getHardwareAddress.overload().implementation = function () {
        var temp = this.getHardwareAddress();
        alertSend("获取Mac地址", "获取到的Mac地址: " + temp)
        return temp;
    };
}

// 获取系统属性（记录关键的）
function getSystemProperties() {
    var SystemProperties = Java.use("android.os.SystemProperties");

    SystemProperties.get.overload('java.lang.String').implementation = function (p1) {
        var temp = this.get(p1);
        if (p1 == "ro.serialno") {
            alertSend("获取设备序列号", "获取(" + p1 + ")，值为：" + temp);
        }
        return temp;
    }

    SystemProperties.get.overload('java.lang.String', 'java.lang.String').implementation = function (p1, p2) {
        var temp = this.get(p1, p2)
        if (p1 == "ro.serialno") {
            alertSend("获取设备序列号", "获取(" + p1 + " 、 " + p2 + ")，值为：" + temp);
        }
        return temp;
    }
}

//获取手机通信录
function getPhoneAddressBook() {
    var contacts_uri = Java.use("android.provider.ContactsContract$Contacts").CONTENT_URI.value.toString();

    var contentResolver = Java.use("android.content.ContentResolver");
    contentResolver.query.overload('android.net.Uri', '[Ljava.lang.String;', 'android.os.Bundle', 'android.os.CancellationSignal').implementation = function (uri, str, bundle, sig) {
        if (uri == contacts_uri) {
            alertSend("获取手机通信录", "获取uri为：" + uri)
        }
        return this.query(uri, str, bundle, sig);
    }
}

// 获取安卓ID
function getAndroidId() {
    var SettingsSecure = Java.use("android.provider.Settings$Secure");

    SettingsSecure.getString.implementation = function (p1, p2) {
        if (p2.indexOf("android_id") < 0) {
            return this.getString(p1, p2);
        }
        var temp = this.getString(p1, p2);
        alertSend("获取Android ID", "参数为：" + p2 + "，获取到的ID为：" + temp);
        return temp;
    }
}

//获取其他app信息
function getPackageManager() {
    var PackageManager = Java.use("android.content.pm.PackageManager");
    var ApplicationPackageManager = Java.use("android.app.ApplicationPackageManager");

    PackageManager.getInstalledPackages.overload('int').implementation = function (p1) {
        var temp = this.getInstalledPackages(p1);
        alertSend("获取其他app信息", "1获取的数据为：" + temp);
        return temp;
    };

    PackageManager.getInstalledApplications.overload('int').implementation = function (p1) {
        var temp = this.getInstalledApplications(p1);
        alertSend("获取其他app信息", "getInstalledApplications获取的数据为：" + temp);
        return temp;
    };

    ApplicationPackageManager.getInstalledPackages.overload('int').implementation = function (p1) {
        var temp = this.getInstalledPackages(p1);
        alertSend("获取其他app信息", "getInstalledPackages获取的数据为：" + temp);
        return temp;
    };

    ApplicationPackageManager.getInstalledApplications.overload('int').implementation = function (p1) {
        var temp = this.getInstalledApplications(p1);
        alertSend("获取其他app信息", "getInstalledApplications获取的数据为：" + temp);
        return temp;
    };

    ApplicationPackageManager.queryIntentActivities.implementation = function (p1, p2) {
        var temp = this.queryIntentActivities(p1, p2);
        alertSend("获取其他app信息", "参数为：" + p1 + p2 + "，queryIntentActivities获取的数据为：" + temp);
        return temp;
    };

    ApplicationPackageManager.getApplicationInfo.implementation = function (p1, p2) {
        var temp = this.getApplicationInfo(p1, p2);
        var string_to_recv;
        // 判断是否为自身应用，是的话不记录
        send({"type": "app_name", "data": p1});

        recv(function (received_json_object) {
            string_to_recv = received_json_object.my_data;
        }).wait();

        if (string_to_recv) {
            alertSend("获取其他app信息", "getApplicationInfo获取的数据为：" + temp);
        }
        return temp;
    };
}

// 获取位置信息
function getGSP() {
    var locationManager = Java.use("android.location.LocationManager");

    locationManager.getLastKnownLocation.overload("java.lang.String").implementation = function (p1) {
        var temp = this.getLastKnownLocation(p1);
        alertSend("获取位置信息", "获取位置信息，参数为：" + p1)
        return temp;
    }

    locationManager.requestLocationUpdates.overload("java.lang.String", "long", "float", "android.location.LocationListener").implementation = function (p1, p2, p3, p4) {
        var temp = this.requestLocationUpdates(p1, p2, p3, p4);
        alertSend("获取位置信息", "获取位置信息")
        return temp;
    }

}

// 调用摄像头(hook，防止静默拍照)
function getCamera() {
    var Camera = Java.use("android.hardware.Camera");

    Camera.open.overload("int").implementation = function (p1) {
        var temp = this.open(p1);
        alertSend("调用摄像头", "调用摄像头id：" + p1.toString())
        return temp;
    }
}

function main() {
    Java.perform(function () {
        console.log("合规检测敏感接口开始监控...");
        send({"type": "isHook"})
        checkRequestPermission();
        getPhoneState();
        getMacAddress();
        getSystemProperties();
        getPhoneAddressBook();
        getAndroidId();
        getPackageManager();
        getGSP();
        getCamera();
    });
}

//在spawn模式下，hook系统API时如javax.crypto.Cipher建议使用setImmediate立即执行，不需要延时
//在spawn模式下，hook应用自己的函数或含壳时，建议使用setTimeout并给出适当的延时(500~5000)

// main();
//setImmediate(main)
// setTimeout(main, 3000);
