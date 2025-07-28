import { EntityCollection, makePropertiesEditable } from "@firecms/core";

export const usersCollectionTemplate: EntityCollection = {
    id: "users",
    path: "users",
    name: "Users",
    singularName: "User",
    description: "Registered users in the app/web",
    icon: "person",
    properties: makePropertiesEditable({
        displayName: {
            name: "Display name",
            type: "string"
        },
        email: {
            name: "Email",
            type: "string",
            email: true
        },
        emailVerified: {
            name: "Email verified",
            type: "boolean"
        },
        phone: {
            name: "Phone",
            type: "string"
        },
        favourite_products: {
            name: "Favourite products",
            type: "array",
            of: {
                type: "reference",
                path: "products"
            }
        },
        photoURL: {
            name: "Photo URL",
            type: "string",
            url: "image"
        }
    }),
};
