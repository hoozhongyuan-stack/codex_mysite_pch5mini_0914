"""Use verified system CA roots when a local Python install lacks its bundle."""
import ssl
from pathlib import Path
from django.core.mail.backends.smtp import EmailBackend
from django.utils.functional import cached_property


def verified_context():
    context = ssl.create_default_context()
    if not context.cert_store_stats()['x509_ca']:
        for candidate in ('/etc/ssl/cert.pem', '/etc/ssl/certs/ca-certificates.crt', '/etc/pki/tls/certs/ca-bundle.crt'):
            path = Path(candidate)
            if path.is_file():
                context.load_verify_locations(cafile=str(path))
                if context.cert_store_stats()['x509_ca']:
                    break
    if not context.cert_store_stats()['x509_ca']:
        raise RuntimeError('未找到可信 CA 证书，请安装系统 ca-certificates 或配置 SSL_CERT_FILE')
    return context


class VerifiedSMTPBackend(EmailBackend):
    @cached_property
    def ssl_context(self):
        return verified_context()
