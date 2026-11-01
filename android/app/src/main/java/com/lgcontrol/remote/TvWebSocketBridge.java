package com.lgcontrol.remote;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import org.json.JSONObject;

import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * Native WebSocket bridge that allows direct, secure communication between
 * the mobile Android application and LG webOS Smart TVs on the local Wi-Fi.
 *
 * This completely bypasses mobile browser sandbox limits and self-signed TLS blocks.
 */
public class TvWebSocketBridge {
    private final BridgeActivity activity;
    private WebSocket webSocket;
    private OkHttpClient httpClient;
    private boolean isConnected = false;

    public TvWebSocketBridge(BridgeActivity activity) {
        this.activity = activity;
        this.httpClient = createTlsPermissiveClient();
    }

    private OkHttpClient createTlsPermissiveClient() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {}

                    @Override
                    public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {}

                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[]{};
                    }
                }
            };

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
            SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();

            return new OkHttpClient.Builder()
                .sslSocketFactory(sslSocketFactory, (X509TrustManager) trustAllCerts[0])
                .hostnameVerifier((hostname, session) -> true)
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .pingInterval(15, TimeUnit.SECONDS)
                .build();
        } catch (Exception e) {
            return new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .build();
        }
    }

    @JavascriptInterface
    public void connect(String url) {
        disconnect();

        try {
            Request request = new Request.Builder()
                .url(url)
                .build();

            this.webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
                @Override
                public void onOpen(@NonNull WebSocket ws, @NonNull Response response) {
                    isConnected = true;
                    runOnWeb("window.__onAndroidBridgeOpen && window.__onAndroidBridgeOpen();");
                }

                @Override
                public void onMessage(@NonNull WebSocket ws, @NonNull String text) {
                    String quoted = JSONObject.quote(text);
                    runOnWeb("window.__onAndroidBridgeMessage && window.__onAndroidBridgeMessage(" + quoted + ");");
                }

                @Override
                public void onClosing(@NonNull WebSocket ws, int code, @NonNull String reason) {
                    isConnected = false;
                    String quotedReason = JSONObject.quote(reason);
                    runOnWeb("window.__onAndroidBridgeClose && window.__onAndroidBridgeClose(" + code + ", " + quotedReason + ");");
                }

                @Override
                public void onClosed(@NonNull WebSocket ws, int code, @NonNull String reason) {
                    isConnected = false;
                    String quotedReason = JSONObject.quote(reason);
                    runOnWeb("window.__onAndroidBridgeClose && window.__onAndroidBridgeClose(" + code + ", " + quotedReason + ");");
                }

                @Override
                public void onFailure(@NonNull WebSocket ws, @NonNull Throwable t, @Nullable Response response) {
                    isConnected = false;
                    String msg = t.getMessage() != null ? t.getMessage() : "Native socket failure";
                    String quoted = JSONObject.quote(msg);
                    runOnWeb("window.__onAndroidBridgeError && window.__onAndroidBridgeError(" + quoted + ");");
                }
            });
        } catch (Exception e) {
            isConnected = false;
            String quoted = JSONObject.quote(e.getMessage() != null ? e.getMessage() : "Failed to open socket");
            runOnWeb("window.__onAndroidBridgeError && window.__onAndroidBridgeError(" + quoted + ");");
        }
    }

    @JavascriptInterface
    public boolean send(String message) {
        if (webSocket != null && isConnected) {
            return webSocket.send(message);
        }
        return false;
    }

    @JavascriptInterface
    public void disconnect() {
        isConnected = false;
        if (webSocket != null) {
            try {
                webSocket.close(1000, "App closed");
            } catch (Exception ignored) {}
            webSocket = null;
        }
    }

    @JavascriptInterface
    public boolean isConnected() {
        return isConnected;
    }

    private void runOnWeb(String script) {
        activity.runOnUiThread(() -> {
            try {
                if (activity.getBridge() != null && activity.getBridge().getWebView() != null) {
                    WebView webView = activity.getBridge().getWebView();
                    webView.evaluateJavascript(script, null);
                }
            } catch (Exception ignored) {}
        });
    }
}
