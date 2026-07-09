package com.bidblitz.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.nfc.FormatException;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.MifareClassic;
import android.nfc.tech.MifareUltralight;
import android.nfc.tech.Ndef;
import android.nfc.tech.NdefFormatable;
import android.nfc.tech.NfcA;
import android.os.Build;
import android.os.Parcelable;
import android.app.PendingIntent;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

@CapacitorPlugin(name = "BidblitzNfc")
public class BidblitzNfcPlugin extends Plugin {
    private NfcAdapter nfcAdapter;
    private boolean scanActive = false;
    private boolean writePending = false;
    private JSArray pendingWriteRecords = null;
    private Tag currentTag = null;

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        if (context != null) {
            nfcAdapter = NfcAdapter.getDefaultAdapter(context);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", nfcAdapter != null && nfcAdapter.isEnabled());
        ret.put("supported", nfcAdapter != null);
        ret.put("platform", "android");
        call.resolve(ret);
    }

    @PluginMethod
    public void startScanning(PluginCall call) {
        if (nfcAdapter == null) {
            call.reject("NFC wird auf diesem Android-Gerät nicht unterstützt");
            return;
        }
        if (!nfcAdapter.isEnabled()) {
            call.reject("NFC ist deaktiviert");
            return;
        }
        enableForegroundDispatch();
        scanActive = true;
        call.resolve();
    }

    @PluginMethod
    public void stopScanning(PluginCall call) {
        disableForegroundDispatch();
        scanActive = false;
        writePending = false;
        pendingWriteRecords = null;
        call.resolve();
    }

    @PluginMethod
    public void writeNdef(PluginCall call) {
        JSArray records = call.getArray("records");
        if (records == null || records.length() == 0) {
            call.reject("Keine NDEF-Records übergeben");
            return;
        }
        pendingWriteRecords = records;
        writePending = true;
        if (!scanActive) {
            enableForegroundDispatch();
            scanActive = true;
        }
        call.resolve();
    }

    @PluginMethod
    public void transceive(PluginCall call) {
        Tag tag = requireCurrentTag(call);
        if (tag == null) return;
        String commandHex = call.getString("commandHex", "");
        if (commandHex.isEmpty()) {
            call.reject("commandHex fehlt");
            return;
        }
        NfcA nfcA = NfcA.get(tag);
        if (nfcA == null) {
            call.reject("Tag unterstützt kein NfcA transceive");
            return;
        }
        try {
            nfcA.connect();
            byte[] response = nfcA.transceive(hexToBytes(commandHex));
            nfcA.close();
            JSObject ret = new JSObject();
            ret.put("responseHex", bytesToHex(response));
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject(ex.getMessage());
        }
    }

    @PluginMethod
    public void readMifareClassic(PluginCall call) {
        Tag tag = requireCurrentTag(call);
        if (tag == null) return;
        MifareClassic classic = MifareClassic.get(tag);
        if (classic == null) {
            call.reject("Kein Mifare Classic Tag erkannt");
            return;
        }
        int sector = call.getInt("sector", 0);
        int block = call.getInt("block", 0);
        try {
            classic.connect();
            authenticateClassic(call, classic, sector);
            int absoluteBlock = classic.sectorToBlock(sector) + block;
            byte[] data = classic.readBlock(absoluteBlock);
            classic.close();
            JSObject ret = new JSObject();
            ret.put("sector", sector);
            ret.put("block", block);
            ret.put("dataHex", bytesToHex(data));
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject(ex.getMessage());
        }
    }

    @PluginMethod
    public void writeMifareClassic(PluginCall call) {
        Tag tag = requireCurrentTag(call);
        if (tag == null) return;
        MifareClassic classic = MifareClassic.get(tag);
        if (classic == null) {
            call.reject("Kein Mifare Classic Tag erkannt");
            return;
        }
        int sector = call.getInt("sector", 0);
        int block = call.getInt("block", 0);
        String dataHex = call.getString("dataHex", "");
        byte[] bytes = hexToBytes(dataHex);
        if (bytes.length != 16) {
            call.reject("Mifare Classic erwartet exakt 16 Byte / 32 Hex-Zeichen");
            return;
        }
        try {
            classic.connect();
            authenticateClassic(call, classic, sector);
            int absoluteBlock = classic.sectorToBlock(sector) + block;
            classic.writeBlock(absoluteBlock, bytes);
            classic.close();
            JSObject ret = new JSObject();
            ret.put("sector", sector);
            ret.put("block", block);
            ret.put("written", true);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject(ex.getMessage());
        }
    }

    @PluginMethod
    public void readMifareUltralight(PluginCall call) {
        Tag tag = requireCurrentTag(call);
        if (tag == null) return;
        MifareUltralight ultralight = MifareUltralight.get(tag);
        if (ultralight == null) {
            call.reject("Kein Mifare Ultralight Tag erkannt");
            return;
        }
        int page = call.getInt("page", 4);
        try {
            ultralight.connect();
            byte[] data = ultralight.readPages(page);
            ultralight.close();
            JSObject ret = new JSObject();
            ret.put("page", page);
            ret.put("dataHex", bytesToHex(data));
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject(ex.getMessage());
        }
    }

    @PluginMethod
    public void writeMifareUltralight(PluginCall call) {
        Tag tag = requireCurrentTag(call);
        if (tag == null) return;
        MifareUltralight ultralight = MifareUltralight.get(tag);
        if (ultralight == null) {
            call.reject("Kein Mifare Ultralight Tag erkannt");
            return;
        }
        int page = call.getInt("page", 4);
        String dataHex = call.getString("dataHex", "");
        byte[] bytes = hexToBytes(dataHex);
        if (bytes.length != 4) {
            call.reject("Mifare Ultralight erwartet exakt 4 Byte / 8 Hex-Zeichen pro Page");
            return;
        }
        try {
            ultralight.connect();
            ultralight.writePage(page, bytes);
            ultralight.close();
            JSObject ret = new JSObject();
            ret.put("page", page);
            ret.put("written", true);
            call.resolve(ret);
        } catch (Exception ex) {
            call.reject(ex.getMessage());
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String action = intent.getAction();
        if (!scanActive || action == null) return;

        Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
        if (tag == null) return;
        currentTag = tag;

        try {
            JSObject payload = buildTagPayload(tag, intent);
            if (writePending && pendingWriteRecords != null) {
                writeRecordsToTag(tag, pendingWriteRecords);
                payload.put("writeSuccess", true);
                writePending = false;
                pendingWriteRecords = null;
            }
            notifyListeners("nfcTagScanned", payload);
        } catch (Exception ex) {
            JSObject error = new JSObject();
            error.put("message", ex.getMessage() == null ? "NFC Fehler" : ex.getMessage());
            notifyListeners("nfcError", error);
        }
    }

    private void enableForegroundDispatch() {
        Activity activity = getActivity();
        if (activity == null || nfcAdapter == null) return;
        Intent intent = new Intent(activity, activity.getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pendingIntent = PendingIntent.getActivity(activity, 0, intent, flags);
        IntentFilter[] filters = new IntentFilter[] {
                new IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED),
                new IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED),
                new IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED)
        };
        try {
            filters[0].addDataType("*/*");
        } catch (IntentFilter.MalformedMimeTypeException ignored) {}
        nfcAdapter.enableForegroundDispatch(activity, pendingIntent, filters, new String[][]{});
    }

    private void disableForegroundDispatch() {
        Activity activity = getActivity();
        if (activity == null || nfcAdapter == null) return;
        try {
            nfcAdapter.disableForegroundDispatch(activity);
        } catch (Exception ignored) {}
    }

    private JSObject buildTagPayload(Tag tag, Intent intent) throws JSONException {
        JSObject out = new JSObject();
        out.put("uid", bytesToHex(tag.getId()));
        out.put("id", bytesToHex(tag.getId()));

        JSArray techs = new JSArray();
        for (String tech : tag.getTechList()) {
            techs.put(tech);
        }
        out.put("techList", techs);
        out.put("isMifareClassic", Arrays.asList(tag.getTechList()).contains(MifareClassic.class.getName()));
        out.put("isMifareUltralight", Arrays.asList(tag.getTechList()).contains(MifareUltralight.class.getName()));
        out.put("supportsNdef", Arrays.asList(tag.getTechList()).contains(Ndef.class.getName()));

        JSArray records = new JSArray();
        Parcelable[] rawMessages = intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES);
        if (rawMessages != null) {
            for (Parcelable raw : rawMessages) {
                NdefMessage msg = (NdefMessage) raw;
                for (NdefRecord record : msg.getRecords()) {
                    JSObject item = new JSObject();
                    item.put("tnf", record.getTnf());
                    item.put("type", new String(record.getType(), StandardCharsets.UTF_8));
                    item.put("payloadText", decodePayload(record));
                    item.put("payloadHex", bytesToHex(record.getPayload()));
                    records.put(item);
                }
            }
        }
        out.put("records", records);
        return out;
    }

    private void writeRecordsToTag(Tag tag, JSArray records) throws IOException, JSONException, FormatException {
        NdefRecord[] androidRecords = new NdefRecord[records.length()];
        for (int i = 0; i < records.length(); i++) {
            JSObject record = JSObject.fromJSONObject(records.getJSONObject(i));
            String type = record.optString("recordType", "text");
            String data = record.optString("data", "");
            if ("url".equals(type)) {
                androidRecords[i] = NdefRecord.createUri(data);
            } else {
                androidRecords[i] = NdefRecord.createTextRecord("de", data);
            }
        }
        NdefMessage message = new NdefMessage(androidRecords);

        Ndef ndef = Ndef.get(tag);
        if (ndef != null) {
            ndef.connect();
            ndef.writeNdefMessage(message);
            ndef.close();
            return;
        }

        NdefFormatable formatable = NdefFormatable.get(tag);
        if (formatable != null) {
            formatable.connect();
            formatable.format(message);
            formatable.close();
            return;
        }

        throw new IOException("Tag unterstützt kein NDEF-Schreiben");
    }

    private String decodePayload(NdefRecord record) {
        try {
            short tnf = record.getTnf();
            byte[] payload = record.getPayload();
            if (tnf == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(record.getType(), NdefRecord.RTD_TEXT)) {
                int languageCodeLength = payload[0] & 0x3F;
                return new String(payload, languageCodeLength + 1, payload.length - languageCodeLength - 1, StandardCharsets.UTF_8);
            }
            if (tnf == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(record.getType(), NdefRecord.RTD_URI)) {
                return new String(payload, StandardCharsets.UTF_8);
            }
            return new String(payload, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return "";
        }
    }

    private String bytesToHex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    private byte[] hexToBytes(String hex) {
        if (hex == null) return new byte[]{};
        String normalized = hex.replace(" ", "").replace(":", "").trim();
        if (normalized.length() % 2 != 0) return new byte[]{};
        byte[] bytes = new byte[normalized.length() / 2];
        for (int i = 0; i < normalized.length(); i += 2) {
            bytes[i / 2] = (byte) Integer.parseInt(normalized.substring(i, i + 2), 16);
        }
        return bytes;
    }

    private Tag requireCurrentTag(PluginCall call) {
        if (currentTag == null) {
            call.reject("Kein NFC-Tag aktiv. Erst scannen/halten.");
            return null;
        }
        return currentTag;
    }

    private void authenticateClassic(PluginCall call, MifareClassic classic, int sector) throws IOException {
        String keyAHex = call.getString("keyAHex", "");
        String keyBHex = call.getString("keyBHex", "");
        boolean authenticated = false;
        if (!keyAHex.isEmpty()) {
            authenticated = classic.authenticateSectorWithKeyA(sector, hexToBytes(keyAHex));
        } else {
            authenticated = classic.authenticateSectorWithKeyA(sector, MifareClassic.KEY_DEFAULT);
        }
        if (!authenticated && !keyBHex.isEmpty()) {
            authenticated = classic.authenticateSectorWithKeyB(sector, hexToBytes(keyBHex));
        }
        if (!authenticated) {
            classic.close();
            throw new IOException("Mifare Classic Auth fehlgeschlagen");
        }
    }
}