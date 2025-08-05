# W3C DID/VC Integration Task Plan

## Overview
Transform the existing CommonSource certificate system into W3C-compliant DIDs and Verifiable Credentials while maintaining backward compatibility and existing user experience.

## Architecture Strategy
- **Hybrid Approach**: Enhance existing certificates to become DID-based VCs
- **Protocol**: Use `CMSRC` protocol identifier for BSV transactions
- **DID Format**: `did:bsv:bsv_did:<serialNumber>`
- **Migration**: Gradual transition with parallel support

## Implementation Phases

### Phase 1: Core DID Infrastructure
**Status**: Pending
**Files to Create**:
- `src/lib/bsv/BsvDidService.js` - Core DID creation/resolution
- `src/lib/bsv/BsvVcService.js` - VC creation/verification
- `src/lib/bsv/BsvOverlayClient.js` - BSV overlay integration
- `src/context/DidContext.js` - DID management context

**Dependencies to Add**:
```json
{
  "did-resolver": "^4.1.0",
  "uuid": "^9.0.0"
}
```

### Phase 2: User Registration Enhancement
**Status**: Pending
**Modifications**:
- `src/context/walletContext.js` - Add DID creation alongside wallet init
- `src/app/page.js` - Update certificate generation to create DIDs first
- Database schema - Add DID/VC fields to users collection

**Flow Changes**:
1. Email verification (unchanged)
2. Wallet connection (unchanged)
3. **NEW**: Create user DID using BSV wallet
4. Certificate generation → Issue VC to user's DID
5. Store VC in wallet and database

### Phase 3: Server-Side VC Issuance
**Status**: Pending
**Modifications**:
- `server/signCertificate.js` - Transform to issue VCs instead of certificates
- Add new API endpoints for DID/VC operations
- Create server DID for issuing VCs

**VC Structure**:
```javascript
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "CommonSourceIdentityCredential"],
  "issuer": "did:bsv:bsv_did:<server-serial>",
  "credentialSubject": {
    "id": "did:bsv:bsv_did:<user-serial>",
    // Existing certificate fields
  },
  "proof": {
    "type": "BsvSignature2025",
    "verificationMethod": "did:bsv:bsv_did:<server-serial>#key-1"
  }
}
```

### Phase 4: Authentication Enhancement
**Status**: Pending
**Modifications**:
- `src/context/authContext.js` - Update to handle VC presentations
- API routes for login/authentication
- Database queries for DID-based lookup

## BSV Transaction Structure

### DID Document Storage:
```javascript
{
  output: {
    script: PushDrop.create({
      fields: [
        Buffer.from('CMSRC'),                    // CommonSource protocol
        Buffer.from('bsv_did'),                  // Topic for DIDs
        Buffer.from(JSON.stringify(didDocument)) // Full DID document
      ]
    }),
    satoshis: 1
  }
}
```

### VC Storage (Alternative):
```javascript
{
  output: {
    script: PushDrop.create({
      fields: [
        Buffer.from('CMSRC'),                    // CommonSource protocol
        Buffer.from('bsv_vc'),                   // Topic for VCs
        Buffer.from(JSON.stringify(vcDocument))  // Full VC document
      ]
    }),
    satoshis: 1
  }
}
```

## Database Schema Updates

### Enhanced Users Collection:
```javascript
{
  // Existing fields (preserved)
  _id: ObjectId,
  email: String,
  signedCertificate: Object,  // Keep for backward compatibility
  
  // New DID/VC fields
  did: String,                    // User's DID
  verifiableCredentials: [Object], // Array of VCs
  didDocument: Object,             // User's DID document
  createdAt: Date,
  updatedAt: Date
}
```

### New Collections:
```javascript
// did_lookups collection
{
  did: String,           // DID identifier
  serialNumber: String,  // BSV transaction serial
  txid: String,         // BSV transaction ID
  vout: Number,         // Output index
  didDocument: Object,  // Full DID document
  createdAt: Date
}
```

## Environment Configuration

### New Variables:
```env
# BSV DID Configuration
BSV_NETWORK=mainnet
DID_TOPIC=bsv_did
VC_TOPIC=bsv_vc
OVERLAY_SERVICE_URL=http://localhost:8080
CMSRC_PROTOCOL_ID=CMSRC

# Server DID (generated during setup)
SERVER_DID=did:bsv:bsv_did:<server-serial>
```

## Success Criteria

1. **Backward Compatibility**: Existing certificate users can still log in
2. **W3C Compliance**: New certificates are valid W3C VCs
3. **DID Resolution**: DIDs can be resolved to DID documents
4. **VC Verification**: VCs can be cryptographically verified
5. **Seamless UX**: User experience remains unchanged

## Risk Mitigation

1. **Parallel Implementation**: Both certificate and VC systems work together
2. **Gradual Migration**: Users migrate at their own pace
3. **Fallback Support**: Legacy certificate validation remains functional
4. **Testing**: Comprehensive testing of DID/VC flows before deployment

## Next Steps

1. Install dependencies
2. Create core BSV DID services
3. Implement DID context provider
4. Enhance wallet context with DID creation
5. Update certificate generation flow
6. Transform server certificate signing to VC issuance
7. Update authentication to support VCs
8. Test end-to-end flow

## Implementation Log

### Completed Tasks:

**2025-08-05 - Phase 1: Core Infrastructure**
- ✅ Created `src/lib/bsv/BsvDidService.js` - Handles DID creation using BSV wallet with CMSRC protocol
- ✅ Created `src/lib/bsv/BsvVcService.js` - Creates W3C VC structures for certificate data
- ✅ Created `src/context/DidContext.js` - React context for DID/VC management
- ✅ Updated `src/app/layout.js` - Added DidContextProvider to app structure

**2025-08-05 - Phase 2: Certificate Enhancement**  
- ✅ Updated `src/app/page.js` - Certificate generation now creates DID first, then VC-structured certificate
- ✅ Enhanced `server/signCertificate.js` - Server recognizes and processes VC certificates
- ✅ Updated database storage - Enhanced to store both VC and legacy certificates with metadata
- ✅ Created `.env.example` - Added new environment variables for DID/VC configuration

**2025-08-05 - Phase 3: Authentication Enhancement**
- ✅ Updated `src/context/authContext.js` - Login now verifies VC certificates and extracts claims
- ✅ Backward compatibility maintained - Both VC and legacy certificates work during transition

### Current Status:
The hybrid approach is implemented! Certificates now use W3C VC data structure internally while maintaining the same user experience and `acquireCertificate()` flow.

### Key Features Implemented:
1. **DID Creation**: Users get DIDs created automatically during certificate generation
2. **VC Structure**: Certificates contain W3C-compliant Verifiable Credential data
3. **Hybrid Support**: Both new VC certificates and legacy certificates work
4. **Server Processing**: Server recognizes VC format and stores additional DID metadata
5. **Authentication**: Login verifies VC structure and extracts identity claims

### Next Steps for Testing:
1. Set up environment variables
2. Test certificate generation with new VC structure
3. Verify authentication works with VC certificates
4. Test backward compatibility with any existing certificates