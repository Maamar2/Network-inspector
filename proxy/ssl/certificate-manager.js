/**
 * SSL Certificate Manager
 * Handles generation and management of CA and domain certificates
 */

const forge = require('node-forge');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { config } = require('../config');

class CertificateManager {
  constructor(options = {}) {
    this.certsDir = options.certsDir || config.ssl.certsDir;
    this.caKeyPath = path.join(this.certsDir, 'ca-key.pem');
    this.caCertPath = path.join(this.certsDir, 'ca.pem');
    this.keysDir = path.join(this.certsDir, 'keys');
    this.ca = null;
    this.domainCache = new Map();
  }

  /**
   * Initialize the certificate manager
   */
  async initialize() {
    await this.ensureDirectories();

    // Check if CA exists
    try {
      await fs.access(this.caCertPath);
      await this.loadCA();
      console.log('[SSL] Loaded existing CA certificate');
    } catch {
      console.log('[SSL] Generating new CA certificate...');
      await this.generateCA();
    }
  }

  /**
   * Ensure certificate directories exist
   */
  async ensureDirectories() {
    await fs.mkdir(this.certsDir, { recursive: true });
    await fs.mkdir(this.keysDir, { recursive: true });
  }

  /**
   * Generate the root CA certificate
   */
  async generateCA() {
    const keys = forge.pki.rsa.generateKeyPair(config.ssl.keySize);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(
      cert.validity.notBefore.getFullYear() + 10
    );

    const attrs = [
      { name: 'commonName', value: config.ssl.caName },
      { name: 'countryName', value: 'US' },
      { name: 'stateOrProvinceName', value: 'California' },
      { name: 'localityName', value: 'San Francisco' },
      { name: 'organizationName', value: 'Network Inspector' },
      { name: 'organizationalUnitName', value: 'Certificate Authority' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true,
        critical: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true,
        critical: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
        emailProtection: true,
        timeStamping: true
      },
      {
        name: 'nsCertType',
        client: true,
        server: true,
        email: true,
        objsign: true,
        sslCA: true,
        emailCA: true,
        objCA: true
      }
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Save CA certificate and key
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

    await fs.writeFile(this.caCertPath, certPem);
    await fs.writeFile(this.caKeyPath, keyPem);

    // Set restrictive permissions on private key
    await fs.chmod(this.caKeyPath, 0o600);

    this.ca = { cert, privateKey: keys.privateKey };

    console.log('[SSL] CA certificate generated successfully');
    console.log(`[SSL] CA Certificate: ${this.caCertPath}`);

    return { certPem, keyPem };
  }

  /**
   * Load existing CA certificate
   */
  async loadCA() {
    const certPem = await fs.readFile(this.caCertPath, 'utf8');
    const keyPem = await fs.readFile(this.caKeyPath, 'utf8');

    this.ca = {
      cert: forge.pki.certificateFromPem(certPem),
      privateKey: forge.pki.privateKeyFromPem(keyPem)
    };
  }

  /**
   * Get or generate certificate for a domain
   */
  async getCertificateForDomain(domain) {
    // Check cache first
    if (this.domainCache.has(domain)) {
      const cached = this.domainCache.get(domain);
      // Check if still valid
      if (cached.cert.validity.notAfter > new Date()) {
        return {
          cert: forge.pki.certificateToPem(cached.cert),
          key: forge.pki.privateKeyToPem(cached.key)
        };
      }
      this.domainCache.delete(domain);
    }

    const certPath = path.join(this.keysDir, `${domain}.pem`);
    const keyPath = path.join(this.keysDir, `${domain}-key.pem`);

    try {
      // Check if certificate exists and is valid
      const certPem = await fs.readFile(certPath, 'utf8');
      const keyPem = await fs.readFile(keyPath, 'utf8');
      const cert = forge.pki.certificateFromPem(certPem);
      const key = forge.pki.privateKeyFromPem(keyPem);

      // Check expiration (with 1 day buffer)
      const bufferDate = new Date();
      bufferDate.setDate(bufferDate.getDate() + 1);
      
      if (cert.validity.notAfter < bufferDate) {
        throw new Error('Certificate expired or expiring soon');
      }

      // Cache and return
      this.domainCache.set(domain, { cert, key });
      return { cert: certPem, key: keyPem };
    } catch (error) {
      // Generate new certificate
      return this.generateDomainCertificate(domain);
    }
  }

  /**
   * Generate a domain-specific certificate
   */
  async generateDomainCertificate(domain) {
    if (!this.ca) {
      throw new Error('CA not initialized');
    }

    const keys = forge.pki.rsa.generateKeyPair(config.ssl.keySize);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = crypto.randomBytes(16).toString('hex');
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setDate(
      cert.validity.notBefore.getDate() + config.ssl.defaultValidityDays
    );

    const attrs = [
      { name: 'commonName', value: domain },
      { name: 'countryName', value: 'US' },
      { name: 'organizationName', value: 'Network Inspector' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(this.ca.cert.subject.attributes);

    // Add Subject Alternative Names
    const altNames = [
      { type: 2, value: domain },
      { type: 2, value: `*.${domain}` }
    ];

    // Handle wildcard domains
    if (domain.startsWith('*.')) {
      altNames.push({ type: 2, value: domain.substring(2) });
    }

    cert.setExtensions([
      {
        name: 'subjectAltName',
        altNames
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true
      }
    ]);

    cert.sign(this.ca.privateKey, forge.md.sha256.create());

    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

    // Save certificate
    await fs.writeFile(
      path.join(this.keysDir, `${domain}.pem`),
      certPem
    );
    await fs.writeFile(
      path.join(this.keysDir, `${domain}-key.pem`),
      keyPem
    );

    // Cache certificate
    this.domainCache.set(domain, { cert, key: keys.privateKey });

    return { cert: certPem, key: keyPem };
  }

  /**
   * Get CA certificate information
   */
  getCAInfo() {
    return {
      path: this.caCertPath,
      pem: this.ca ? forge.pki.certificateToPem(this.ca.cert) : null
    };
  }

  /**
   * Get CA certificate PEM
   */
  async getCACertPem() {
    if (!this.ca) {
      await this.loadCA();
    }
    return forge.pki.certificateToPem(this.ca.cert);
  }

  /**
   * Clear domain certificate cache
   */
  clearCache() {
    this.domainCache.clear();
  }

  /**
   * Clean up expired certificates
   */
  async cleanup() {
    const now = new Date();
    const files = await fs.readdir(this.keysDir);

    for (const file of files) {
      if (file.endsWith('.pem')) {
        const filePath = path.join(this.keysDir, file);
        try {
          const certPem = await fs.readFile(filePath, 'utf8');
          const cert = forge.pki.certificateFromPem(certPem);

          if (cert.validity.notAfter < now) {
            await fs.unlink(filePath);
            // Also delete corresponding key file
            const keyFile = file.replace('.pem', '-key.pem');
            const keyPath = path.join(this.keysDir, keyFile);
            try {
              await fs.unlink(keyPath);
            } catch {
              // Key file might not exist
            }
            console.log(`[SSL] Cleaned up expired certificate: ${file}`);
          }
        } catch (error) {
          console.error(`[SSL] Error cleaning up ${file}:`, error.message);
        }
      }
    }
  }
}

module.exports = CertificateManager;
