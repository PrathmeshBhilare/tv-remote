package com.lgcontrol.remote;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        attachBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        attachBridge();
    }

    private void attachBridge() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new TvWebSocketBridge(this), "AndroidBridge");
        }
    }
}
