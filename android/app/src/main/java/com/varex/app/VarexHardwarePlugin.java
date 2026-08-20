package com.varex.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "VarexHardware",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN })
    }
)
public class VarexHardwarePlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private boolean needsBluetoothPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    @PluginMethod
    public void listPairedPrinters(PluginCall call) {
        if (needsBluetoothPermission()) {
            requestPermissionForAlias("bluetooth", call, "bluetoothPermissionCallback");
            return;
        }
        resolvePairedPrinters(call);
    }

    @PermissionCallback
    private void bluetoothPermissionCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) resolvePairedPrinters(call);
        else call.reject("يجب السماح بالاتصال بالأجهزة القريبة لاستخدام طابعة البلوتوث.");
    }

    private void resolvePairedPrinters(PluginCall call) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) { call.reject("هذا الجهاز لا يدعم البلوتوث."); return; }
            if (!adapter.isEnabled()) { call.reject("يرجى تشغيل البلوتوث أولاً."); return; }
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            JSArray printers = new JSArray();
            for (BluetoothDevice device : bonded) {
                JSObject item = new JSObject();
                item.put("name", device.getName() == null ? "Bluetooth Printer" : device.getName());
                item.put("address", device.getAddress());
                printers.put(item);
            }
            JSObject result = new JSObject(); result.put("printers", printers); call.resolve(result);
        } catch (SecurityException error) { call.reject("تعذر قراءة أجهزة البلوتوث المقترنة.", error); }
    }

    @PluginMethod
    public void printReceipt(PluginCall call) {
        String transport = call.getString("transport", "bluetooth");
        if ("bluetooth".equals(transport) && needsBluetoothPermission()) {
            requestPermissionForAlias("bluetooth", call, "printPermissionCallback");
            return;
        }
        executePrint(call);
    }

    @PermissionCallback
    private void printPermissionCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) executePrint(call);
        else call.reject("يجب السماح بالاتصال بالأجهزة القريبة للطباعة.");
    }

    private void executePrint(PluginCall call) {
        executor.execute(() -> {
            String transport = call.getString("transport", "bluetooth");
            String address = call.getString("address", "");
            Integer requestedPort = call.getInt("port", 9100);
            int port = requestedPort == null ? 9100 : requestedPort;
            boolean openDrawer = Boolean.TRUE.equals(call.getBoolean("openDrawer", false));
            String imageBase64 = call.getString("imageBase64", "");
            if (address.trim().isEmpty()) { call.reject("لم يتم تحديد عنوان الطابعة."); return; }
            try {
                byte[] imageBytes = Base64.decode(imageBase64, Base64.DEFAULT);
                Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
                if (bitmap == null) throw new IllegalArgumentException("تعذر تجهيز صورة الفاتورة.");
                byte[] payload = receiptPayload(bitmap, openDrawer);
                if ("network".equals(transport)) printNetwork(address, port, payload);
                else printBluetooth(address, payload);
                JSObject result = new JSObject(); result.put("printed", true); result.put("transport", transport); call.resolve(result);
            } catch (Exception error) { call.reject("تعذرت الطباعة. تحقق من تشغيل الطابعة والاتصال بها.", error); }
        });
    }

    private void printNetwork(String host, int port, byte[] payload) throws Exception {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 5000);
            socket.setSoTimeout(5000);
            OutputStream output = socket.getOutputStream(); output.write(payload); output.flush();
        }
    }

    private void printBluetooth(String address, byte[] payload) throws Exception {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) throw new IllegalStateException("Bluetooth is disabled");
        BluetoothDevice device = adapter.getRemoteDevice(address);
        try (BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID)) {
            adapter.cancelDiscovery(); socket.connect();
            OutputStream output = socket.getOutputStream(); output.write(payload); output.flush();
        }
    }

    private byte[] receiptPayload(Bitmap source, boolean openDrawer) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write(new byte[]{0x1B, 0x40});
        output.write(bitmapToEscPos(source));
        output.write(new byte[]{0x1B, 0x64, 0x04});
        if (openDrawer) output.write(new byte[]{0x1B, 0x70, 0x00, 0x19, (byte)0xFA});
        output.write(new byte[]{0x1D, 0x56, 0x42, 0x00});
        return output.toByteArray();
    }

    private byte[] bitmapToEscPos(Bitmap bitmap) throws Exception {
        int width = bitmap.getWidth(), height = bitmap.getHeight(), bytesPerRow = (width + 7) / 8;
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write(new byte[]{0x1D, 0x76, 0x30, 0x00, (byte)(bytesPerRow & 0xFF), (byte)((bytesPerRow >> 8) & 0xFF), (byte)(height & 0xFF), (byte)((height >> 8) & 0xFF)});
        for (int y = 0; y < height; y++) {
            for (int xByte = 0; xByte < bytesPerRow; xByte++) {
                int value = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int x = xByte * 8 + bit;
                    if (x >= width) continue;
                    int color = bitmap.getPixel(x, y), alpha = (color >> 24) & 0xFF, red = (color >> 16) & 0xFF, green = (color >> 8) & 0xFF, blue = color & 0xFF;
                    int luminance = (red * 299 + green * 587 + blue * 114) / 1000;
                    if (alpha > 80 && luminance < 175) value |= (1 << (7 - bit));
                }
                output.write(value);
            }
        }
        return output.toByteArray();
    }
}
