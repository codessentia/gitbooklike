import React, { useCallback, useEffect, useRef, useState } from "react";

import { DragDropContext, Draggable, DraggableProvided, Droppable } from "@hello-pangea/dnd";

import { getHashValue } from "../util";
import {
    AddIcon,
    Button,
    cls,
    ContentCopyIcon,
    HandleIcon,
    IconButton,
    KeyboardArrowDownIcon,
    KeyboardArrowUpIcon,
    Menu,
    MenuItem,
    RemoveIcon,
    Tooltip,
    useOutsideAlerter
} from "@firecms/ui";

export type ArrayEntryParams = {
    index: number,
    internalId: number,
    isDragging: boolean,
    storedProps?: object,
    storeProps: (props: object) => void
};

export type ArrayEntryBuilder = (params: ArrayEntryParams) => React.ReactNode;

export interface ArrayContainerProps<T> {
    droppableId: string;
    value: T[];
    addLabel: string;
    buildEntry: ArrayEntryBuilder;
    disabled?: boolean;
    size?: "small" | "medium";
    onInternalIdAdded?: (id: number) => void;
    /**
     * @deprecated Use `canAddElements` instead
     */
    includeAddButton?: boolean;
    canAddElements?: boolean;
    sortable?: boolean;
    newDefaultEntry: T;
    onValueChange: (value: T[]) => void,
    className?: string;
    min?: number;
    max?: number;
}

const buildIdsMap = (value: any[]) =>
    value && Array.isArray(value) && value.length > 0
        ? value.map((v, index) => {
            if (!v) return {};
            return ({
                [getHashValue(v) + index]: getRandomId()
            });
        }).reduce((a, b) => ({ ...a, ...b }), {})
        : {}

/**
 * @group Form custom fields
 */
export function ArrayContainer<T>({
                                      droppableId,
                                      addLabel,
                                      value,
                                      disabled = false,
                                      buildEntry,
                                      size = "medium",
                                      onInternalIdAdded,
                                      includeAddButton: deprecatedIncludeAddButton,
                                      canAddElements: canAddElementsProp = true,
                                      sortable = true,
                                      newDefaultEntry,
                                      onValueChange,
                                      className,
                                      min = 0,
                                      max = Infinity
                                  }: ArrayContainerProps<T>) {

    const canAddElements = (canAddElementsProp || canAddElementsProp === undefined)
        && (deprecatedIncludeAddButton === undefined || deprecatedIncludeAddButton);

    const hasValue = value && Array.isArray(value) && value.length > 0;

    // Used to track the ids that have displayed the initial show animation
    const internalIdsRef = useRef<Record<string, number>>(buildIdsMap(value));

    const [internalIds, setInternalIds] = useState<number[]>(
        hasValue
            ? Object.values(internalIdsRef.current)
            : []
    );

    const itemCustomPropsRef = useRef<Record<number, object>>({});

    const updateItemCustomProps = useCallback((internalId: number, customProps: object) => {
        itemCustomPropsRef.current[internalId] = customProps;
    }, []);

    useEffect(() => {
        if (hasValue && value && value.length !== internalIds.length) {
            const newInternalIds = value.map((v, index) => {
                const hashValue = getHashValue(v) + index;
                if (hashValue in internalIdsRef.current) {
                    return internalIdsRef.current[hashValue];
                } else {
                    const newInternalId = getRandomId();
                    internalIdsRef.current[hashValue] = newInternalId;
                    return newInternalId;
                }
            });
            setInternalIds(newInternalIds);
        }
    }, [hasValue, internalIds.length, value]);

    const insertInEnd = (e: React.SyntheticEvent) => {
        e.preventDefault();
        if (disabled || (value ?? []).length >= max) return;
        const id = getRandomId();
        const newIds: number[] = [...internalIds, id];
        if (onInternalIdAdded)
            onInternalIdAdded(id);
        setInternalIds(newIds);
        onValueChange([...(value ?? []), newDefaultEntry]);
    };

    const remove = (index: number) => {
        if ((value ?? []).length <= min) return;
        const newIds = [...internalIds];
        newIds.splice(index, 1);
        setInternalIds(newIds);
        onValueChange(value.filter((_, i) => i !== index));
    };

    const copy = (index: number) => {
        if ((value ?? []).length >= max) return;
        const id = getRandomId();
        const copyingItem = value[index];
        const newIds: number[] = [
            ...internalIds.slice(0, index + 1),
            id,
            ...internalIds.slice(index + 1)
        ];
        if (onInternalIdAdded)
            onInternalIdAdded(id);
        setInternalIds(newIds);
        // insert value in index + 1
        onValueChange([...value.slice(0, index + 1), copyingItem, ...value.slice(index + 1)]);
    };

    const addInIndex = (index: number) => {
        if ((value ?? []).length >= max) return;
        const id = getRandomId();
        const newIds: number[] = [
            ...internalIds.slice(0, index),
            id,
            ...internalIds.slice(index)
        ];
        if (onInternalIdAdded)
            onInternalIdAdded(id);
        setInternalIds(newIds);
        onValueChange([...value.slice(0, index), newDefaultEntry, ...value.slice(index)]);
    }

    const onDragEnd = (result: any) => {
        // dropped outside the list
        if (!result.destination) {
            return;
        }
        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;

        const newIds = [...internalIds];
        const temp = newIds[sourceIndex];
        newIds[sourceIndex] = newIds[destinationIndex];
        newIds[destinationIndex] = temp;
        setInternalIds(newIds);

        onValueChange(arrayMove(value, sourceIndex, destinationIndex));
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={droppableId}
                       renderClone={(provided, snapshot, rubric) => {
                           const index = rubric.source.index;
                           const internalId = internalIds[index];
                           return (
                               <ArrayContainerItem
                                   provided={provided}
                                   internalId={internalId}
                                   index={index}
                                   size={size}
                                   disabled={disabled}
                                   buildEntry={buildEntry}
                                   remove={remove}
                                   copy={copy}
                                   isDragging={snapshot.isDragging}
                                   storedProps={itemCustomPropsRef.current[internalId]}
                                   updateItemCustomProps={updateItemCustomProps}
                                   addInIndex={addInIndex}
                                   canAddElements={canAddElements}
                                   sortable={sortable}
                               />
                           );
                       }}
            >
                {(droppableProvided, droppableSnapshot) => (
                    <div
                        className={cls("space-y-1", className)}
                        {...droppableProvided.droppableProps}
                        ref={droppableProvided.innerRef}>
                        {hasValue && internalIds.map((internalId: number, index: number) => {
                            return (
                                <Draggable
                                    key={`array_field_${internalId}`}
                                    draggableId={`array_field_${internalId}`}
                                    isDragDisabled={disabled || !sortable}
                                    index={index}>
                                    {(provided, snapshot) => (
                                        <ArrayContainerItem
                                            provided={provided}
                                            internalId={internalId}
                                            index={index}
                                            size={size}
                                            disabled={disabled}
                                            buildEntry={buildEntry}
                                            remove={remove}
                                            copy={copy}
                                            isDragging={snapshot.isDragging}
                                            storedProps={itemCustomPropsRef.current[internalId]}
                                            updateItemCustomProps={updateItemCustomProps}
                                            addInIndex={addInIndex}
                                            canAddElements={canAddElements}
                                            sortable={sortable}
                                        />
                                    )}
                                </Draggable>
                            );
                        })}

                        {droppableProvided.placeholder}

                        {canAddElements && (
                            <div className="my-4 justify-center text-left">
                                <Button
                                    variant={"text"}
                                    size={size === "small" ? "small" : "medium"}
                                    color="primary"
                                    disabled={disabled || value?.length >= max}
                                    startIcon={<AddIcon/>}
                                    onClick={insertInEnd}>
                                    {addLabel ?? "Add"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}

type ArrayContainerItemProps = {
    provided: DraggableProvided,
    index: number,
    internalId: number,
    size?: "small" | "medium",
    disabled: boolean,
    buildEntry: ArrayEntryBuilder,
    remove: (index: number) => void,
    copy: (index: number) => void,
    addInIndex?: (index: number) => void,
    canAddElements?: boolean,
    sortable: boolean,
    isDragging: boolean,
    storedProps?: object,
    updateItemCustomProps: (internalId: number, props: object) => void
};

export function ArrayContainerItem({
                                       provided,
                                       index,
                                       internalId,
                                       size,
                                       disabled,
                                       buildEntry,
                                       remove,
                                       addInIndex,
                                       canAddElements,
                                       sortable,
                                       copy,
                                       isDragging,
                                       storedProps,
                                       updateItemCustomProps
                                   }: ArrayContainerItemProps) {

    return <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        style={provided.draggableProps.style}
        className={`relative ${
            !isDragging ? "hover:bg-surface-accent-50 dark:hover:bg-surface-800/20" : ""
        } rounded-md opacity-100`}
    >
        <div
            className="flex items-start">
            <div
                className="grow w-[calc(100%-48px)] text-text-primary dark:text-text-primary-dark">
                {buildEntry({
                    index,
                    internalId,
                    isDragging,
                    storedProps,
                    storeProps: (props: object) => updateItemCustomProps(internalId, props)
                })}
            </div>
            <ArrayItemOptions direction={size === "small" ? "row" : "column"}
                              disabled={disabled}
                              remove={remove}
                              index={index}
                              provided={provided}
                              addInIndex={addInIndex}
                              canAddElements={canAddElements}
                              sortable={sortable}
                              copy={copy}/>
        </div>
    </div>;
}

export function ArrayItemOptions({
                                     direction,
                                     disabled,
                                     remove,
                                     index,
                                     provided,
                                     copy,
                                     canAddElements,
                                     sortable,
                                     addInIndex
                                 }: {
    direction?: "row" | "column",
    disabled: boolean,
    remove: (index: number) => void,
    index: number,
    provided: any,
    copy: (index: number) => void,
    sortable: boolean,
    canAddElements?: boolean,
    addInIndex?: (index: number) => void
}) {

    const [menuOpen, setMenuOpen] = useState(false);

    const iconRef = React.useRef<HTMLDivElement>(null);
    useOutsideAlerter(iconRef, () => setMenuOpen(false));

    return <div className={`pl-2 pt-1 pb-1 flex ${direction === "row" ? "flex-row-reverse" : "flex-col"} items-center`}
                ref={iconRef}
                {...provided.dragHandleProps}>
        <Tooltip
            delayDuration={400}
            open={menuOpen ? false : undefined}
            side={direction === "column" ? "left" : undefined}
            title={!disabled && sortable ? "Drag to move. Click for more options" : undefined}>
            <IconButton
                size="small"
                disabled={disabled || !canAddElements}
                onClick={(e) => {
                    e.preventDefault();
                    setMenuOpen(true);
                }}
                onDragStart={(e: any) => {
                    setMenuOpen(false);
                }}
                className={disabled || !sortable ? "cursor-inherit" : "cursor-grab"}>
                <HandleIcon/>
            </IconButton>

            <Menu
                portalContainer={iconRef.current}
                open={menuOpen}
                trigger={<div tabIndex={-1}/>}>

                <MenuItem dense onClick={(e) => {
                    setMenuOpen(false);
                    remove(index);
                }}>
                    <RemoveIcon size={"small"}/>
                    Remove
                </MenuItem>
                <MenuItem dense onClick={() => {
                    setMenuOpen(false);
                    copy(index);
                }}>
                    <ContentCopyIcon size={"small"}/>
                    Copy
                </MenuItem>

                {addInIndex && <MenuItem dense
                                         onClick={() => {
                                             setMenuOpen(false);
                                             addInIndex(index);
                                         }}>
                    <KeyboardArrowUpIcon size={"small"}/>
                    Add on top
                </MenuItem>}

                {addInIndex && <MenuItem dense
                                         onClick={() => {
                                             setMenuOpen(false);
                                             addInIndex(index + 1);
                                         }}>
                    <KeyboardArrowDownIcon size={"small"}/>
                    Add below
                </MenuItem>}

            </Menu>
        </Tooltip>

    </div>;
}

function arrayMove(value: any[], sourceIndex: number, destinationIndex: number) {
    const result = Array.from(value);
    const [removed] = result.splice(sourceIndex, 1);
    result.splice(destinationIndex, 0, removed);
    return result;
}

export function getRandomId() {
    return Math.floor(Math.random() * Math.floor(Number.MAX_SAFE_INTEGER));
}
