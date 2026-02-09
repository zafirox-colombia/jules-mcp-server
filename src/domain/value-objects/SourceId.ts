/**
 * Value Object: SourceId
 * 
 * Encapsula el ID de fuente (repositorio) de Jules.
 * Formato típico: 'github-owner-repo' o 'sources/github/owner/repo'
 */

export class SourceId {
    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    /**
     * Crea un SourceId desde un string.
     * @throws {Error} si el ID es vacío o inválido
     */
    static fromString(id: string): SourceId {
        if (!id || id.trim().length === 0) {
            throw new Error('SourceId no puede estar vacío');
        }
        return new SourceId(id.trim());
    }

    /**
     * Crea un SourceId desde owner y repo de GitHub.
     */
    static fromGitHub(owner: string, repo: string): SourceId {
        if (!owner || !repo) {
            throw new Error('Owner y repo son requeridos para crear SourceId');
        }
        return new SourceId(`sources/github/${owner}/${repo}`);
    }

    /**
     * Retorna el ID del source.
     */
    toString(): string {
        return this.value;
    }

    /**
     * Retorna el ID en formato de ruta API.
     */
    toApiPath(): string {
        if (this.value.startsWith('sources/')) {
            return this.value;
        }
        return `sources/${this.value}`;
    }

    /**
     * Compara dos SourceIds por igualdad de valor.
     */
    equals(other: SourceId): boolean {
        return this.value === other.value;
    }
}
