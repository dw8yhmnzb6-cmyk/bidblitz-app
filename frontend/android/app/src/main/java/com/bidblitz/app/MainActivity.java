package com.bidblitz.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BidblitzNfcPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
