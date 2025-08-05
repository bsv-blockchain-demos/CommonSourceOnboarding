import { Utils } from '@bsv/sdk';

/**
 * BSV Verifiable Credential Service for CommonSource
 * 
 * This service creates W3C VC structures that will be used as certificate data
 * in the existing acquireCertificate() flow.
 */
export class BsvVcService {
  constructor(bsvDidService) {
    this.bsvDidService = bsvDidService;
  }

  /**
   * Create W3C VC structure for use as certificate data
   * This replaces the flat fields structure with a W3C-compliant VC
   */
  createIdentityCredentialData(options) {
    try {
      const {
        issuerDid,      // Server's DID
        subjectDid,     // User's DID
        username,
        residence,
        age,
        gender,
        email,
        work,
        validFrom,
        validUntil
      } = options;

      console.log('[BsvVcService] Creating identity VC data structure...');

      // Generate unique credential ID
      const credentialId = this.generateId();

      // Create W3C-compliant VC structure that will become the certificate fields
      const vcData = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://commonsource.io/contexts/identity/v1'
        ],
        id: credentialId,
        type: ['VerifiableCredential', 'CommonSourceIdentityCredential'],
        issuer: issuerDid,
        issuanceDate: (validFrom || new Date()).toISOString(),
        ...(validUntil && { expirationDate: validUntil.toISOString() }),
        credentialSubject: {
          id: subjectDid,
          username,
          residence,
          age,
          gender,
          email,
          work
        }
      };

      console.log(`[BsvVcService] Created VC data structure: ${credentialId}`);
      return vcData;

    } catch (error) {
      console.error('[BsvVcService] Error creating VC data:', error);
      throw new Error(`Failed to create VC data: ${error.message}`);
    }
  }

  /**
   * Verify a certificate that contains VC data
   * This works with certificates retrieved from wallet.listCertificates()
   */
  verifyCertificateVC(certificate) {
    try {
      console.log('[BsvVcService] Verifying certificate VC structure...');

      // Extract VC data from certificate fields
      const vcData = certificate.fields || certificate;

      // Basic W3C VC validation
      const requiredFields = ['@context', 'id', 'type', 'issuer', 'issuanceDate', 'credentialSubject'];
      
      for (const field of requiredFields) {
        if (!vcData[field]) {
          console.log(`[BsvVcService] Missing field: ${field}`);
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }

      // Validate context
      if (!vcData['@context'] || !vcData['@context'].includes('https://www.w3.org/2018/credentials/v1')) {
        return { valid: false, error: 'Invalid @context: missing W3C credentials context' };
      }

      // Validate types
      if (!vcData.type || !vcData.type.includes('VerifiableCredential')) {
        return { valid: false, error: 'Invalid type: must include VerifiableCredential' };
      }

      // Check expiration
      if (vcData.expirationDate) {
        const expirationDate = new Date(vcData.expirationDate);
        if (expirationDate < new Date()) {
          return { valid: false, error: 'Credential has expired' };
        }
      }

      console.log('[BsvVcService] Certificate VC validation passed');
      return {
        valid: true,
        vcData: vcData,
        claims: this.extractIdentityClaims(vcData)
      };

    } catch (error) {
      console.error('[BsvVcService] Certificate VC verification failed:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Extract identity claims from VC data for authentication
   */
  extractIdentityClaims(vcData) {
    try {
      const subject = vcData.credentialSubject;
      
      return {
        did: subject.id,
        username: subject.username,
        residence: subject.residence,
        age: subject.age,
        gender: subject.gender,
        email: subject.email,
        work: subject.work,
        // Add metadata
        issuer: vcData.issuer,
        issuanceDate: vcData.issuanceDate,
        expirationDate: vcData.expirationDate
      };

    } catch (error) {
      console.error('[BsvVcService] Error extracting identity claims:', error);
      throw error;
    }
  }

  /**
   * Check if a certificate contains VC data (vs legacy format)
   * This helps during the transition period
   */
  isVCCertificate(certificate) {
    try {
      const fields = certificate.fields || certificate;
      return fields && 
             fields['@context'] && 
             fields.type && 
             fields.type.includes('VerifiableCredential');
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a simple UUID for VC IDs
   */
  generateId() {
    return 'urn:uuid:' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}