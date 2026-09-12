-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
