package com.lgcontrol.remote;

import android.util.Base64;
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

import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * Native WebSocket bridge that manages independent, secure WebSocket connections
 * between the mobile Android application and LG webOS Smart TVs on local Wi-Fi.
 *
 * Supports concurrent sockets (e.g. SSAP command socket and Pointer input socket).
 */
public class TvWebSocketBridge {
    private final BridgeActivity activity;
    private final Map<String, WebSocket> sockets = new ConcurrentHashMap<>();
    private final OkHttpClient httpClient;

    public TvWebSocketBridge(BridgeActivity activity) {
        this.activity = activity;
        this.httpClient = createTlsPermissiveClient();
    }

    private static String toSafeJsArg(String text) {
        if (text == null) return "''";
        try {
            byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
            String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            return "decodeURIComponent(escape(atob('" + b64 + "')))";
        } catch (Exception e) {
            return "''";
        }
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
    public void connect(String socketId, String url) {
        disconnect(socketId);

        try {
            Request request = new Request.Builder()
                .url(url)
                .build();

            WebSocket ws = httpClient.newWebSocket(request, new WebSocketListener() {
                @Override
                public void onOpen(@NonNull WebSocket ws, @NonNull Response response) {
                    sockets.put(socketId, ws);
                    runOnWeb("window.__onAndroidBridgeOpen && window.__onAndroidBridgeOpen('" + socketId + "');");
                }

                @Override
                public void onMessage(@NonNull WebSocket ws, @NonNull String text) {
                    String safeArg = toSafeJsArg(text);
                    runOnWeb("window.__onAndroidBridgeMessage && window.__onAndroidBridgeMessage('" + socketId + "', " + safeArg + ");");
                }

                @Override
                public void onClosing(@NonNull WebSocket ws, int code, @NonNull String reason) {
                    sockets.remove(socketId);
                    String safeArg = toSafeJsArg(reason);
                    runOnWeb("window.__onAndroidBridgeClose && window.__onAndroidBridgeClose('" + socketId + "', " + code + ", " + safeArg + ");");
                }

                @Override
                public void onClosed(@NonNull WebSocket ws, int code, @NonNull String reason) {
                    sockets.remove(socketId);
                    String safeArg = toSafeJsArg(reason);
                    runOnWeb("window.__onAndroidBridgeClose && window.__onAndroidBridgeClose('" + socketId + "', " + code + ", " + safeArg + ");");
                }

                @Override
                public void onFailure(@NonNull WebSocket ws, @NonNull Throwable t, @Nullable Response response) {
                    sockets.remove(socketId);
                    String msg = t.getMessage() != null ? t.getMessage() : "Native socket failure";
                    String safeArg = toSafeJsArg(msg);
                    runOnWeb("window.__onAndroidBridgeError && window.__onAndroidBridgeError('" + socketId + "', " + safeArg + ");");
                }
            });
            sockets.put(socketId, ws);
        } catch (Exception e) {
            sockets.remove(socketId);
            String safeArg = toSafeJsArg(e.getMessage() != null ? e.getMessage() : "Failed to open socket");
            runOnWeb("window.__onAndroidBridgeError && window.__onAndroidBridgeError('" + socketId + "', " + safeArg + ");");
        }
    }

    @JavascriptInterface
    public void connect(String url) {
        connect("default", url);
    }

    @JavascriptInterface
    public boolean send(String socketId, String message) {
        WebSocket ws = sockets.get(socketId);
        if (ws != null) {
            return ws.send(message);
        }
        return false;
    }

    @JavascriptInterface
    public boolean send(String message) {
        return send("default", message);
    }

    @JavascriptInterface
    public void disconnect(String socketId) {
        WebSocket ws = sockets.remove(socketId);
        if (ws != null) {
            try {
                ws.close(1000, "App closed");
            } catch (Exception ignored) {}
        }
    }

    @JavascriptInterface
    public void disconnect() {
        for (String id : sockets.keySet()) {
            disconnect(id);
        }
    }

    @JavascriptInterface
    public boolean isConnected(String socketId) {
        return sockets.containsKey(socketId);
    }

    @JavascriptInterface
    public boolean isConnected() {
        return !sockets.isEmpty();
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
