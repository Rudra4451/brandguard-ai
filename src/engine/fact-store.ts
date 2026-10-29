import { FactSchema, FactStoreSchema, type Fact } from './types';


export class FactStore {
  private facts: Map<string, Fact> = new Map();

  constructor(initialFacts: Fact[] = []) {
    for (const fact of initialFacts) {
      const parsed = FactSchema.parse(fact);
      this.facts.set(parsed.id, parsed);
    }
  }

  public list(): Fact[] {
    return Array.from(this.facts.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  public async getFullVersion(): Promise<string> {
    const sortedFacts = this.list();
    const { canonicalJSON, sha256 } = await import('./hasher');
    return sha256(canonicalJSON({ facts: sortedFacts }));
  }

  public get(id: string): Fact | undefined {

    return this.facts.get(id);
  }

  public create(fact: unknown): Fact {
    const parsed = FactSchema.parse(fact);
    if (this.facts.has(parsed.id)) {
      throw new Error(`Fact with ID '${parsed.id}' already exists.`);
    }
    this.facts.set(parsed.id, parsed);
    return parsed;
  }

  public update(id: string, updates: Partial<Fact>): Fact {
    const existing = this.facts.get(id);
    if (!existing) {
      throw new Error(`Fact with ID '${id}' not found.`);
    }
    const merged = { ...existing, ...updates, id };
    const validated = FactSchema.parse(merged);
    this.facts.set(id, validated);
    return validated;
  }

  public delete(id: string): boolean {
    return this.facts.delete(id);
  }

  public search(query: string): Fact[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.list();
    return this.list().filter(
      (f) =>
        f.statement.toLowerCase().includes(q) ||
        f.sourceName.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
    );
  }

  public exportJSON(): string {
    return JSON.stringify({ facts: this.list() }, null, 2);
  }

  public importJSON(jsonStr: string): void {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Malformed JSON string: ' + String(e));
    }

    const validated = FactStoreSchema.parse(parsedJson);

    // Atomic replacement
    const newMap = new Map<string, Fact>();
    for (const fact of validated.facts) {
      if (newMap.has(fact.id)) {
        throw new Error(`Duplicate fact ID in import: ${fact.id}`);
      }
      newMap.set(fact.id, fact);
    }

    this.facts = newMap;
  }
}
