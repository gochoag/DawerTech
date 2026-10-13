package com.dawertech.inventory;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import org.junit.Test;

public class ApkInstallerMetadataTest {
    private PluginCall call(String json) throws Exception {
        return new PluginCall(null, "ApkInstaller", "test", "download", new JSObject(json));
    }

    @Test public void javascriptIntegerSizeSurvivesTheCapacitorBridge() throws Exception {
        PluginCall call = call("{\"versionCode\":5,\"size\":5991122}");
        assertTrue(call.getData().opt("size") instanceof Integer);
        assertEquals(0L, call.getLong("size", 0L).longValue());
        assertEquals(5991122L, ApkInstallerPlugin.readDownloadSize(call));
    }

    @Test public void theWholePermittedApkSizeRangeFitsAnInteger() throws Exception {
        assertEquals(1L, ApkInstallerPlugin.readDownloadSize(call("{\"size\":1}")));
        assertEquals(67108864L, ApkInstallerPlugin.readDownloadSize(call("{\"size\":67108864}")));
    }

    @Test public void missingAndNonIntegerSizesRemainInvalid() throws Exception {
        for (String json : new String[] { "{}", "{\"size\":null}", "{\"size\":true}",
                "{\"size\":\"5991122\"}", "{\"size\":5991122.5}", "{\"size\":2147483648}" }) {
            assertEquals(json, 0L, ApkInstallerPlugin.readDownloadSize(call(json)));
        }
    }
}
