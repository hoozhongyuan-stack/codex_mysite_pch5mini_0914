CREATE UNIQUE INDEX product_spu_unique ON contents (lower(json_extract(data,'$.spu'))) WHERE kind='products' AND json_extract(data,'$.spu') IS NOT NULL AND json_extract(data,'$.spu')<>'';
