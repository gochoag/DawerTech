package com.dawertech.inventory;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {
    private static final long MAX_BYTES = 64L * 1024 * 1024;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile boolean foreground;
    private SharedPreferences preferences;
    private DownloadManager downloads;

    @Override public void load() {
        preferences = getContext().getSharedPreferences("dawertech-apk-download", Context.MODE_PRIVATE);
        downloads = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    }

    private void run(PluginCall call, Task task) {
        worker.execute(() -> {
            try { call.resolve(task.run()); }
            catch (Exception error) {
                String message = (error instanceof UpdateFailure || error.getClass() == Exception.class) && error.getMessage() != null ? error.getMessage() : "Android no pudo completar la descarga o preparar la instalacion. Intentalo de nuevo.";
                String code = error instanceof UpdateFailure ? ((UpdateFailure) error).code : "APK_OPERATION_FAILED";
                Log.w("DawerTechUpdates", "method=" + call.getMethodName() + " code=" + code);
                preferences.edit().putString("phase", "error").putString("error", message).putBoolean("auto", false).apply();
                call.reject(message, code);
            }
        });
    }
    private interface Task { JSObject run() throws Exception; }
    private static final class UpdateFailure extends Exception {
        final String code;
        UpdateFailure(String code, String message) { super(message); this.code = code; }
    }

    static long readDownloadSize(PluginCall call) {
        // El JSON del puente usa Integer para estos bytes (limite 64 MiB).
        // PluginCall.getLong solo acepta Long y devuelve cero para Integer.
        return call.getInt("size", 0);
    }

    @PluginMethod public void download(PluginCall call) {
        run(call, () -> {
            Uri uri = Uri.parse(call.getString("url", ""));
            int code = call.getInt("versionCode", 0);
            long size = readDownloadSize(call);
            String hash = call.getString("sha256", "");
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                throw new UpdateFailure("APK_INVALID_URL", "La descarga del APK debe usar HTTPS.");
            if (code <= installedCode())
                throw new UpdateFailure("APK_NOT_NEWER", "El APK publicado no es mas reciente que la version instalada. Busca actualizaciones de nuevo.");
            if (size <= 0 || size > MAX_BYTES)
                throw new UpdateFailure("APK_INVALID_SIZE", "No se recibio un tamaño valido para el APK. Busca actualizaciones de nuevo.");
            if (!hash.isEmpty() && !hash.matches("[a-f0-9]{64}"))
                throw new UpdateFailure("APK_INVALID_DIGEST", "Los datos de verificacion del APK no son validos. Busca actualizaciones de nuevo.");
            if (preferences.getInt("code", 0) == code && !"error".equals(preferences.getString("phase", ""))) {
                if ("deferred".equals(preferences.getString("phase", ""))) preferences.edit().putString("phase", "ready").putBoolean("auto", true).apply();
                JSObject current = state();
                if (!"idle".equals(current.getString("phase"))) return current;
            }
            clear();
            File folder = updateDirectory();
            if (!folder.exists() && !folder.mkdirs()) throw new Exception("No hay espacio para guardar el APK.");
            File file = new File(folder, "dawertech-update-" + code + ".apk");
            if (file.exists() && !file.delete()) throw new Exception("No se pudo preparar el archivo de actualizacion.");
            DownloadManager.Request request = new DownloadManager.Request(uri)
                .setTitle("Actualizacion de DawerTech")
                .setDescription("Descargando APK")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, "updates/" + file.getName());
            long id = downloads.enqueue(request);
            preferences.edit().putLong("id", id).putInt("code", code).putLong("size", size)
                .putString("version", call.getString("version", ""))
                .putString("hash", hash).putString("phase", "downloading").putBoolean("auto", true).apply();
            return state();
        });
    }

    @PluginMethod public void getState(PluginCall call) { run(call, this::state); }
    @PluginMethod public void cancel(PluginCall call) { run(call, () -> { clear(); return value("idle", 0, 0, ""); }); }
    @PluginMethod public void deferInstall(PluginCall call) {
        run(call, () -> {
            preferences.edit().putString("phase", "deferred").putBoolean("auto", false).putBoolean("awaitingPermission", false).apply();
            return value("idle", 0, 0, "");
        });
    }
    @PluginMethod public void install(PluginCall call) {
        run(call, () -> {
            validate();
            if (!foreground) return state();
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                preferences.edit().putString("phase", "permission").putBoolean("awaitingPermission", true).putBoolean("auto", false).apply();
                open(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())));
            } else launchInstaller();
            return value(preferences.getString("phase", "ready"), preferences.getLong("size", 0), preferences.getLong("size", 0), "");
        });
    }

    private JSObject state() throws Exception {
        String phase = preferences.getString("phase", "downloading");
        long id = preferences.getLong("id", 0);
        if (id != 0 && preferences.getInt("code", 0) <= installedCode()) { clear(); return value("idle", 0, 0, ""); }
        if ("error".equals(phase)) return value(phase, 0, 0, preferences.getString("error", "La descarga fallo."));
        if (id == 0) return value("idle", 0, 0, "");
        if ("deferred".equals(phase)) return value("idle", 0, 0, "");
        try (Cursor cursor = downloads.query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor == null || !cursor.moveToFirst()) { clear(); return value("idle", 0, 0, ""); }
            long received = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            if (total <= 0) total = preferences.getLong("size", 0);
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (received > MAX_BYTES || total > MAX_BYTES) { clear(); throw new Exception("El APK supera el tamaño permitido."); }
            if (status == DownloadManager.STATUS_FAILED) {
                int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                downloads.remove(id);
                throw new Exception(reason == DownloadManager.ERROR_INSUFFICIENT_SPACE ? "No hay espacio libre para descargar el APK." : "La descarga fallo. Revisa tu conexion e intentalo de nuevo.");
            }
            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                if (!preferences.getBoolean("validated", false)) {
                    validate();
                    preferences.edit().putBoolean("validated", true).apply();
                }
                if (!"installing".equals(phase) && !"permission".equals(phase)) phase = "ready";
                return value(phase, total, total, "");
            }
            return value(status == DownloadManager.STATUS_PAUSED ? "paused" : "downloading", received, total, "");
        }
    }

    private JSObject value(String phase, long received, long total, String error) {
        JSObject value = new JSObject();
        value.put("phase", phase); value.put("received", received); value.put("total", total);
        value.put("message", error); value.put("autoInstall", preferences.getBoolean("auto", false));
        value.put("version", preferences.getString("version", ""));
        return value;
    }

    private File updateDirectory() throws Exception {
        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) throw new Exception("El almacenamiento del celular no esta disponible.");
        return new File(directory, "updates");
    }
    private File apk() throws Exception { return new File(updateDirectory(), "dawertech-update-" + preferences.getInt("code", 0) + ".apk"); }
    private long installedCode() throws Exception {
        PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }
    private Signature[] signers(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
    }
    private void validate() throws Exception {
        File file = apk();
        if (!file.isFile() || file.length() != preferences.getLong("size", 0) || file.length() > MAX_BYTES)
            throw new Exception("La descarga del APK esta incompleta. Vuelve a descargarla.");
        String hash = preferences.getString("hash", "");
        if (!hash.isEmpty()) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (FileInputStream input = new FileInputStream(file)) {
                byte[] buffer = new byte[32768]; int count;
                while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
            }
            StringBuilder actual = new StringBuilder();
            for (byte b : digest.digest()) actual.append(String.format("%02x", b & 255));
            if (!hash.equals(actual.toString())) throw new Exception("El APK no paso la verificacion. Vuelve a descargarlo.");
        }
        PackageManager manager = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo update = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo current = manager.getPackageInfo(getContext().getPackageName(), flags);
        if (update == null || !current.packageName.equals(update.packageName)) throw new Exception("El archivo descargado no es un APK de DawerTech.");
        long code = Build.VERSION.SDK_INT >= 28 ? update.getLongVersionCode() : update.versionCode;
        if (code != preferences.getInt("code", 0) || code <= installedCode()) throw new Exception("El APK no corresponde a una version mas reciente.");
        Signature[] expected = signers(current), actual = signers(update);
        if (expected == null || actual == null || expected.length == 0 || expected.length != actual.length ||
            !Arrays.asList(expected).containsAll(Arrays.asList(actual)) || !Arrays.asList(actual).containsAll(Arrays.asList(expected)))
            throw new Exception("La firma del APK es diferente. Usa una actualizacion firmada con la misma clave.");
    }

    private void launchInstaller() throws Exception {
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk());
        Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        preferences.edit().putString("phase", "installing").putBoolean("auto", false).apply();
        open(intent);
    }
    private void open(Intent intent) throws Exception {
        if (getActivity() == null || !foreground) throw new Exception("Vuelve a la app para continuar la instalacion.");
        getActivity().runOnUiThread(() -> {
            try { getActivity().startActivity(intent); }
            catch (Exception error) { preferences.edit().putString("phase", "error").putString("error", "Android no pudo abrir el instalador. Intentalo de nuevo.").apply(); }
        });
    }
    private void clear() throws Exception {
        long id = preferences.getLong("id", 0);
        if (id != 0) downloads.remove(id);
        if (preferences.getInt("code", 0) > 0) {
            File file = apk();
            if (file.exists() && !file.delete()) throw new Exception("No se pudo retirar el APK temporal.");
        }
        preferences.edit().clear().apply();
    }

    @Override protected void handleOnResume() {
        foreground = true;
        worker.execute(() -> {
            try {
                if (preferences.getBoolean("awaitingPermission", false)) {
                    preferences.edit().putBoolean("awaitingPermission", false).apply();
                    if (Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls()) { validate(); launchInstaller(); }
                } else if ("installing".equals(preferences.getString("phase", ""))) preferences.edit().putString("phase", "ready").apply();
            } catch (Exception error) { preferences.edit().putString("phase", "error").putString("error", "No se pudo continuar la instalacion. Intentalo de nuevo.").apply(); }
        });
    }
    @Override protected void handleOnPause() { foreground = false; }
    @Override protected void handleOnDestroy() { worker.shutdown(); }
}
