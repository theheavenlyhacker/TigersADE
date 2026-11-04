CREATE TABLE "branches" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"today" integer NOT NULL,
	"week" integer NOT NULL,
	"mtd" integer NOT NULL,
	"target" integer NOT NULL
);
