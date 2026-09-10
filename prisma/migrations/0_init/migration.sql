-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CreateTable
CREATE TABLE "todos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CreateTable
CREATE TABLE "posts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" INTEGER,
    "image_path" TEXT,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
    "updated_at" TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "post_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "author_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_used_at" TEXT,
    "revoked_at" TEXT,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_comments_post" ON "comments"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_api_keys_user" ON "api_keys"("user_id");

