// Test-process-only trust for a generated loopback TLS certificate. Never
// modifies the system trust store or ships as a production plugin dependency.
#include <QQmlExtensionPlugin>
#include <QSslConfiguration>
#include <QSslCertificate>
#include <qqml.h>

class TrustPlugin: public QQmlExtensionPlugin {
    Q_OBJECT
    Q_PLUGIN_METADATA(IID QQmlExtensionInterface_iid)
public:
    void registerTypes(const char *uri) override {
        auto config = QSslConfiguration::defaultConfiguration();
        auto certs = config.caCertificates();
        certs.append(QSslCertificate::fromPath(qEnvironmentVariable("MARKET_TEST_CA")));
        config.setCaCertificates(certs);
        QSslConfiguration::setDefaultConfiguration(config);
        qmlRegisterModule(uri, 1, 0);
    }
};
#include "TrustPlugin.moc"
