# cat manifest.json | ruby lib/sign.rb certs/appointment.pem secret certs/wwdc.pem

require "digest/sha1"
require "openssl"
require "base64"

HEADER = "filename=\"smime.p7s\"\n\n"
FOOTER = "\n\n------"

manifest      = STDIN.read
p12_cert      = ARGV[0]
p12_password  = ARGV[1]
wwdc_cert     = ARGV[2]

p12   = OpenSSL::PKCS12.new(File.read(p12_cert), p12_password)
wwdc  = OpenSSL::X509::Certificate.new(File.read(wwdc_cert))
pk7   = OpenSSL::PKCS7.sign(p12.certificate, p12.key, manifest, [wwdc], OpenSSL::PKCS7::BINARY | OpenSSL::PKCS7::DETACHED)
smime = OpenSSL::PKCS7.write_smime(pk7)

body = smime[smime.index(HEADER) + HEADER.length..smime.length-1]
body = body[0..body.index(FOOTER)-1]

STDOUT.write Base64.decode64(body)
