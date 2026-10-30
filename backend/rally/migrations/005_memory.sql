CREATE VIEW shop_agent_memory AS
SELECT * FROM (
 SELECT o.id AS order_id,o.created_at,o.final_terms,s.shop_id,
 row_number() OVER(PARTITION BY s.shop_id ORDER BY o.created_at DESC,o.id) AS ordinal
 FROM orders o JOIN (
  SELECT DISTINCT order_id,data->>'shop' AS shop_id FROM deal_events
  WHERE data->>'kind' IN ('bid','pass','error') AND data ? 'shop'
 ) s ON s.order_id=o.id
 WHERE o.final_terms ? 'auction'
) history WHERE ordinal<=20;
