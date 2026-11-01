package com.lgcontrol.remote;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private TvWebSocketBridge webSocketBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webSocketBridge = new TvWebSocketBridge(this);
        attachBridge();
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
            webView.getSettings().setDomStorageEnabled(true);
            webView.getSettings().setDatabaseEnabled(true);
            if (webSocketBridge == null) {
                webSocketBridge = new TvWebSocketBridge(this);
            }
            webView.addJavascriptInterface(webSocketBridge, "AndroidBridge");
        }
    }
}
