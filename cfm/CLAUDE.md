# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

The Cloud Information Model (CIM) is a semantic business data model using JSON-LD and SHACL to define entities, properties, and schemas across multiple subject areas (Account, Party, Product, Payment, etc.). The model provides both conceptual ontologies (`concepts.jsonld`) and canonical data schemas (`schema.jsonld`) that can be compiled into various formats (OAS 3, RAML, gRPC, GraphQL).

## Architecture

### Directory Structure

```
src/
  context.jsonld              # JSON-LD context shared by all files
  subjectAreas/{area}/        # Business domain groupings
    about.jsonld              # Subject area description
    {entityGroup}/
      concepts.jsonld         # Conceptual ontology (RDF/RDFS Classes and Properties)
      schema.jsonld           # Canonical schema (SHACL Shapes with constraints)
  propertyGroups/{group}/     # Reusable cross-domain properties
    concepts.jsonld           # Shared property definitions

dist/                         # Generated single-file distributions
  model.jsonld                # Complete model as single JSON-LD file
  schema.json                 # OpenAPI Specification 3 schema
  schema.raml                 # RAML 1.0 schema
  schema.proto                # gRPC/Protocol Buffers schema
  schema.graphql              # GraphQL schema
```

### Data Model Layers

1. **Conceptual Model** (`concepts.jsonld`): Business-level ontology using RDF/RDFS
   - `@type: "Class"` defines entity types (Account, Contact, Product, etc.)
   - `@type: "Property"` defines attributes with `domain` (which classes have this property) and `range` (data type or target class)
   - Properties like `subClassOf` establish inheritance hierarchies

2. **Canonical Schema** (`schema.jsonld`): Technical data constraints using SHACL
   - `@type: "Shape"` with `targetClass` specifies validation rules for each entity
   - `properties` array defines constraints: `path` (property name), `datatype`, `minCount`, `maxCount`, `node` (references to other shapes)

3. **Subject Areas**: Top-level business domains
   - Account: Customer/business relationships and hierarchies
   - Party: People, organizations, roles, contact points, leads
   - Product: Catalogs, attributes, pricing, currency
   - Payment/PaymentMethod: Transaction processing
   - SalesOrder: Order management
   - Shipment: Fulfillment and logistics

4. **Property Groups**: Cross-cutting concerns reused across subject areas
   - Address, ContactInfo, Demographic, Financial, Geographic, etc.
   - Defined once in `src/propertyGroups/{group}/concepts.jsonld`
   - Referenced by multiple entity groups

### JSON-LD Context

All JSON-LD files reference `http://cloudinformationmodel.org/context.jsonld` (stored at `src/context.jsonld`), which maps:
- Short names to full URIs (e.g., `cim:`, `rdfs:`, `sh:`, `xsd:`)
- Property aliases for RDFS and SHACL vocabularies
- Container types for lists and sets

## Key Concepts

### Entity Groups vs Property Groups
- **Entity Groups**: Complete domain models (e.g., `src/subjectAreas/Account/Account/`) containing both concepts and schemas for business entities
- **Property Groups**: Reusable property collections (e.g., `src/propertyGroups/Address/`) that are composed into entity schemas

### Concepts vs Schemas
- **Concepts** define the semantic meaning ("what is a Customer?")
- **Schemas** define structural constraints ("Customer must have exactly one name, zero or more phone numbers")

### GUID-based Identity
- Every major element (`@id` field) uses a GUID to ensure global uniqueness
- Human-readable names are in the `name` field

## Working with the Model

### Reading Entity Definitions

To understand an entity like "Account":
1. Read subject area overview: `src/subjectAreas/Account/about.jsonld`
2. Read conceptual model: `src/subjectAreas/Account/Account/concepts.jsonld`
   - Check `classConcepts` for entity types and their descriptions
   - Check `propertyConcepts` for attributes (note the `domain` field showing which classes use each property)
3. Read canonical schema: `src/subjectAreas/Account/Account/schema.jsonld`
   - Find the Shape with matching `targetClass`
   - Examine `properties` array for data types, cardinality, and constraints

### Understanding Property Domains

Properties define which classes can use them via the `domain` field:
```json
{
  "@id": "accountNumber",
  "domain": ["Account"]
}
```

Multiple domains indicate shared properties:
```json
{
  "@id": "faxPhoneId",
  "domain": ["Account", "AccountContact"]
}
```

### Cross-referencing

Properties reference other entities via `range` (in concepts) or `node` (in schemas):
- Concepts: `"range": "Party"` means the property points to a Party entity
- Schemas: `"node": "guid-of-target-shape"` references another SHACL Shape

### Distribution Formats

The `dist/` directory contains compiled versions:
- **model.jsonld**: All source files merged into one JSON-LD document
- **schema.json**: OAS 3 format for REST API design
- **schema.raml**: RAML 1.0 for API documentation tools
- **schema.proto**: Protocol Buffers for gRPC services
- **schema.graphql**: GraphQL schema for query APIs

These are generated from the source model and should be considered read-only.

## Model Versioning

All subject areas, entity groups, and the model itself include `"version": "1.0.0"` fields. When extending or modifying the model, update version numbers following semantic versioning.

## Common Tasks

### Finding an Entity Definition
1. Check `src/subjectAreas/` for likely subject area (e.g., Party for people-related, Account for customer relationships)
2. List directories under that subject area to find entity groups
3. Read `concepts.jsonld` for business meaning, `schema.jsonld` for technical structure

### Tracing Property Usage
Search for the property ID across all files:
```bash
grep -r "propertyName" src/
```

Check both `propertyConcepts` (where it's defined) and `properties` arrays (where it's used in schemas).

### Understanding Relationships
Look for:
- `subClassOf` in concepts for inheritance
- Properties with entity types in `range` for associations
- Properties ending in `Id` typically reference other entities

## License

Apache 2.0 - see LICENSE file
