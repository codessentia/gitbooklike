import { EntityService } from "../db/entityService";
import { RealtimeService } from "./realtimeService";
import { Database } from "../db/connection";
import {
    DeleteEntityRequest,
    Entity,
    EntityCollection,
    FetchCollectionRequest,
    FetchEntityRequest,
    SaveEntityRequest
} from "../types";
import { PgTable } from "drizzle-orm/pg-core";

export interface DataSourceDelegate {
    key: string;
    initialised?: boolean;

    fetchCollection<M extends Record<string, any>>(props: FetchCollectionRequest<M>): Promise<Entity<M>[]>;

    fetchEntity<M extends Record<string, any>>(props: FetchEntityRequest<M>): Promise<Entity<M> | undefined>;

    saveEntity<M extends Record<string, any>>(props: SaveEntityRequest<M>): Promise<Entity<M>>;

    deleteEntity<M extends Record<string, any>>(props: DeleteEntityRequest<M>): Promise<void>;

    checkUniqueField(path: string, name: string, value: any, entityId?: string, collection?: EntityCollection): Promise<boolean>;

    generateEntityId(path: string, collection?: EntityCollection): string;

    countEntities?<M extends Record<string, any>>(props: FetchCollectionRequest<M>): Promise<number>;

    isFilterCombinationValid?(props: any): boolean;

    currentTime?: () => any;
    delegateToCMSModel: (data: any) => any;
    cmsToDelegateModel: (data: any) => any;
    setDateToMidnight: (input?: any) => any;
    initTextSearch?: (props: any) => Promise<boolean>;
}

export class PostgresDataSourceDelegate implements DataSourceDelegate {
    key = "postgres";
    initialised = true;

    private entityService: EntityService;
    private realtimeService: RealtimeService;

    constructor(
        private db: Database,
        realtimeService: RealtimeService,
        tables: Record<string, PgTable>
    ) {
        this.entityService = new EntityService(db, tables);
        this.realtimeService = realtimeService;
    }

    async fetchCollection<M extends Record<string, any>>({
                                                             path,
                                                             collection,
                                                             filter,
                                                             limit,
                                                             startAfter,
                                                             orderBy,
                                                             searchString,
                                                             order
                                                         }: FetchCollectionRequest<M>): Promise<Entity<M>[]> {

        if (searchString) {
            return this.entityService.searchEntities<M>(
                path,
                searchString,
                collection?.databaseId
            );
        }

        return this.entityService.fetchCollection<M>(path, {
            filter,
            orderBy,
            order,
            limit,
            startAfter,
            databaseId: collection?.databaseId
        });
    }

    async fetchEntity<M extends Record<string, any>>({
                                                         path,
                                                         entityId,
                                                         databaseId,
                                                         collection
                                                     }: FetchEntityRequest<M>): Promise<Entity<M> | undefined> {
        return this.entityService.fetchEntity<M>(
            path,
            entityId,
            databaseId || collection?.databaseId
        );
    }

    async saveEntity<M extends Record<string, any>>({
                                                        path,
                                                        entityId,
                                                        values,
                                                        collection,
                                                        status
                                                    }: SaveEntityRequest<M>): Promise<Entity<M>> {

        const savedEntity = await this.entityService.saveEntity<M>(
            path,
            values,
            entityId,
            collection?.databaseId
        );

        // Notify real-time subscribers
        await this.realtimeService.notifyEntityUpdate(
            path,
            savedEntity.id.toString(),
            savedEntity,
            collection?.databaseId
        );

        return savedEntity;
    }

    async deleteEntity<M extends Record<string, any>>({
                                                          entity,
                                                          collection
                                                      }: DeleteEntityRequest<M>): Promise<void> {

        console.log("🗑️ [DataSourceDelegate] Starting delete for entity:", entity.id, "in path:", entity.path);

        await this.entityService.deleteEntity(
            entity.path,
            entity.id,
            entity.databaseId || collection?.databaseId
        );

        console.log("🗑️ [DataSourceDelegate] Entity deleted from database, now notifying real-time subscribers");

        // Use the EXACT SAME notification system as saveEntity - this is the key!
        await this.realtimeService.notifyEntityUpdate(
            entity.path,
            entity.id.toString(),
            null, // null indicates deletion
            entity.databaseId || collection?.databaseId
        );

        console.log("🗑️ [DataSourceDelegate] Real-time notification sent for deletion");
    }

    async checkUniqueField(
        path: string,
        name: string,
        value: any,
        entityId?: string,
        collection?: EntityCollection
    ): Promise<boolean> {
        return this.entityService.checkUniqueField(
            path,
            name,
            value,
            entityId,
            collection?.databaseId
        );
    }

    generateEntityId(path: string, collection?: EntityCollection): string {
        return this.entityService.generateEntityId();
    }

    async countEntities<M extends Record<string, any>>({
                                                           path,
                                                           collection
                                                       }: FetchCollectionRequest<M>): Promise<number> {
        return this.entityService.countEntities(path, collection?.databaseId);
    }

    isFilterCombinationValid(): boolean {
        // PostgreSQL with proper indexing supports most filter combinations
        return true;
    }

    currentTime(): Date {
        return new Date();
    }

    // Data transformation methods to maintain compatibility with FireCMS
    delegateToCMSModel(data: any): any {
        if (data === null || data === undefined) return data;

        if (data instanceof Date) {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(item => this.delegateToCMSModel(item));
        }

        if (typeof data === "object") {
            const result: Record<string, any> = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = this.delegateToCMSModel(value);
            }
            return result;
        }

        return data;
    }

    cmsToDelegateModel(data: any): any {
        if (data === undefined) {
            return null; // PostgreSQL doesn't support undefined
        }

        if (data === null) return data;

        if (data instanceof Date) {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(item => this.cmsToDelegateModel(item));
        }

        if (typeof data === "object") {
            const result: Record<string, any> = {};
            for (const [key, value] of Object.entries(data)) {
                const converted = this.cmsToDelegateModel(value);
                if (converted !== null) {
                    result[key] = converted;
                }
            }
            return result;
        }

        return data;
    }

    setDateToMidnight(input?: Date): Date | undefined {
        if (!input || !(input instanceof Date)) return input;
        const date = new Date(input);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    async initTextSearch(): Promise<boolean> {
        // Text search is implemented in the searchEntities method
        return true;
    }

    private generateSubscriptionId(): string {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
