package app.edge.reactnative.beldexcore;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.util.HashMap;
import java.util.Map;

public class BeldexModule extends ReactContextBaseJavaModule {
  private native String callMyBeldexJNI(String method, String[] arguments);

  private native String[] getMethodNames();

  static {
    System.loadLibrary("mybeldex-jni");
  }

  public BeldexModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public Map<String, Object> getConstants() {
    final Map<String, Object> constants = new HashMap<>();
    constants.put("methodNames", getMethodNames());
    return constants;
  }

  @Override
  public String getName() {
    return "BeldexCore";
  }

  @ReactMethod
  public void callMyBeldex(String method, ReadableArray arguments, Promise promise) {
    // Re-package the arguments:
    String[] strings = new String[arguments.size()];
    for (int i = 0; i < arguments.size(); ++i) {
      strings[i] = arguments.getString(i);
    }

    try {
      promise.resolve(callMyBeldexJNI(method, strings));
    } catch (Exception e) {
      promise.reject("BeldexError", e);
    }
  }
}
