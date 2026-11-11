package app.noto.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotoWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
