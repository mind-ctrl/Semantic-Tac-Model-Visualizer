// Core types for the parsed semantic model

export interface CalculationGroup {
  tableName: string;
  precedence: number;
  calculationItems: CalculationItem[];
}

export interface CalculationItem {
  name: string;
  expression: string;
  ordinal: number;
}

export interface SemanticModel {
  name: string;
  tables: Table[];
  relationships: Relationship[];
  roles: Role[];
  dataSources: DataSource[];
  cultures: string[];
  perspectives: string[];
  calculationGroups: CalculationGroup[];
}

export interface Table {
  name: string;
  columns: Column[];
  measures: Measure[];
  partitions: Partition[];
  type: "entity" | "calculated";
  isHidden: boolean;
  description: string;
}

export interface Column {
  name: string;
  dataType: string;
  sourceColumn: string;
  isHidden: boolean;
  description: string;
  sortByColumn: string;
  dataCategory: string;
}

export interface Measure {
  name: string;
  expression: string;
  displayFolder: string;
  description: string;
  formatString: string;
  isHidden: boolean;
}

export interface Partition {
  name: string;
  mode: "import" | "directLake" | "directQuery" | "dual" | "default";
  source: PartitionSource;
}

export interface PartitionSource {
  type: string;
  expression: string;
  entityName?: string;
  schemaName?: string;
  url?: string;
}

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  crossFilteringBehavior: "single" | "bothDirections";
  isActive: boolean;
}

export interface Role {
  name: string;
  description: string;
  modelPermission: string;
  tablePermissions: TablePermission[];
  columnPermissions: ColumnPermission[];
}

export interface ColumnPermission {
  tableName: string;
  columnName: string;
  metadataPermission: "none" | "default" | "read";
}

export interface TablePermission {
  tableName: string;
  filterExpression: string;
}

export interface DataSource {
  name: string;
  type: string;
  connectionString: string;
}

// Derived analysis types

export interface TableClassification {
  table: Table;
  role: "fact" | "dimension" | "bridge" | "measure" | "utility";
  partitionMode: string;
  incomingRelationships: Relationship[];
  outgoingRelationships: Relationship[];
}

export interface MeasureDependency {
  measure: Measure;
  tableName: string;
  dependsOnMeasures: { tableName: string; measureName: string }[];
  dependsOnColumns: { tableName: string; columnName: string }[];
}

export interface RlsFilterFlow {
  role: Role;
  directlyFiltered: string[];
  downstreamFiltered: string[];
  unaffected: string[];
}
