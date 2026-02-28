/**
 * Schema Validator
 * Validates context nodes, packs, and policies against JSON Schemas
 *
 * Spec: specs/05-data-structures.md
 * Tests: src/validator/schema-validator.test.ts
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  ContextNode,
  ContextPack,
  Policy,
  BundleManifest,
  ExportApproval,
  ValidationResult,
} from '../types/index.js';

const SCHEMAS_DIR = join(process.cwd(), 'schemas');

/**
 * Load JSON Schema from file
 */
function loadSchema(filename: string): object {
  const path = join(SCHEMAS_DIR, filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

export class SchemaValidator {
  private ajv: Ajv;
  private nodeValidator: ValidateFunction;
  private packValidator: ValidateFunction;
  private policyValidator: ValidateFunction;
  private manifestValidator: ValidateFunction;
  private approvalValidator: ValidateFunction;

  constructor() {
    // Initialize Ajv with strict mode and formats
    this.ajv = new Ajv({
      allErrors: true,
      strict: true,
      validateFormats: true,
    });
    addFormats(this.ajv);

    // Load and compile schemas
    try {
      const nodeSchema = loadSchema('context-node.schema.json');
      const packSchema = loadSchema('context-pack.schema.json');
      const policySchema = loadSchema('policy.schema.json');
      const manifestSchema = loadSchema('bundle-manifest.schema.json');
      const approvalSchema = loadSchema('export-approval.schema.json');

      this.nodeValidator = this.ajv.compile(nodeSchema);
      this.packValidator = this.ajv.compile(packSchema);
      this.policyValidator = this.ajv.compile(policySchema);
      this.manifestValidator = this.ajv.compile(manifestSchema);
      this.approvalValidator = this.ajv.compile(approvalSchema);
    } catch (error) {
      throw new Error(`Failed to load schemas: ${error}`);
    }
  }

  /**
   * Validate a Context Node
   * Spec: specs/05-data-structures.md - Data Structure 1
   */
  validateNode(node: ContextNode): ValidationResult {
    const valid = this.nodeValidator(node);
    if (valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: this.formatErrors(this.nodeValidator.errors || []),
    };
  }

  /**
   * Validate a Context Pack
   * Spec: specs/05-data-structures.md - Data Structure 2
   */
  validatePack(pack: ContextPack): ValidationResult {
    const valid = this.packValidator(pack);
    if (valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: this.formatErrors(this.packValidator.errors || []),
    };
  }

  /**
   * Validate a Policy
   * Spec: specs/05-data-structures.md - Data Structure 3
   */
  validatePolicy(policy: Policy): ValidationResult {
    const valid = this.policyValidator(policy);
    if (valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: this.formatErrors(this.policyValidator.errors || []),
    };
  }

  /**
   * Validate a Bundle Manifest
   * Spec: specs/05-data-structures.md - Data Structure 4
   */
  validateManifest(manifest: BundleManifest): ValidationResult {
    const valid = this.manifestValidator(manifest);
    if (valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: this.formatErrors(this.manifestValidator.errors || []),
    };
  }

  /**
   * Validate an Export Approval
   * Spec: specs/05-data-structures.md - Data Structure 5
   */
  validateApproval(approval: ExportApproval): ValidationResult {
    const valid = this.approvalValidator(approval);
    if (valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: this.formatErrors(this.approvalValidator.errors || []),
    };
  }

  /**
   * Format Ajv errors into our ValidationResult format
   */
  private formatErrors(ajvErrors: any[]): Array<{ path: string; message: string; value?: any }> {
    return ajvErrors.map(err => ({
      path: err.instancePath || err.schemaPath || 'root',
      message: this.formatErrorMessage(err),
      value: err.data,
    }));
  }

  /**
   * Format human-readable error message
   */
  private formatErrorMessage(err: any): string {
    const field = err.instancePath.split('/').pop() || 'field';

    switch (err.keyword) {
      case 'required':
        return `Missing required field: ${err.params.missingProperty}`;
      case 'type':
        return `${field} must be ${err.params.type}`;
      case 'pattern':
        return `${field} format is invalid (must match pattern: ${err.params.pattern})`;
      case 'minLength':
        return `${field} must be at least ${err.params.limit} characters`;
      case 'maxLength':
        return `${field} must be at most ${err.params.limit} characters`;
      case 'minimum':
        return `${field} must be >= ${err.params.limit}`;
      case 'maximum':
        return `${field} must be <= ${err.params.limit}`;
      case 'minItems':
        return `${field} must have at least ${err.params.limit} items`;
      case 'enum':
        return `${field} must be one of: ${err.params.allowedValues.join(', ')}`;
      case 'format':
        return `${field} must be valid ${err.params.format} format`;
      case 'additionalProperties':
        return `${field} has unexpected property: ${err.params.additionalProperty}`;
      default:
        return err.message || 'Validation error';
    }
  }

  /**
   * Validate any entity type based on content analysis
   */
  validate(data: any): ValidationResult {
    // Detect entity type from id pattern
    if (data.id) {
      if (data.id.startsWith('ulid:')) {
        return this.validateNode(data);
      } else if (data.id.startsWith('pack:')) {
        return this.validatePack(data);
      } else if (data.id.startsWith('policy:')) {
        return this.validatePolicy(data);
      }
    }

    // Check for bundle manifest
    if (data.bundle_id) {
      return this.validateManifest(data);
    }

    // Check for approval
    if (data.approval_id) {
      return this.validateApproval(data);
    }

    return {
      valid: false,
      errors: [{ path: 'root', message: 'Unable to determine entity type for validation' }],
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const validator = new SchemaValidator();
