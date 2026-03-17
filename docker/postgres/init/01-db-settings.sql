-- Database defaults for consistent behavior across environments.
ALTER DATABASE CURRENT_DATABASE() SET timezone TO 'UTC';
ALTER DATABASE CURRENT_DATABASE() SET datestyle TO 'ISO, MDY';
