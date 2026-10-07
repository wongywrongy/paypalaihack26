import type { Product } from '../api';

export default function ProductPhoto({product,className=''}:{product:Product;className?:string}) {
  return product.image_position ? <div className={'product-photo '+className} role="img" aria-label={`Illustrative photograph of ${product.title}`} style={{backgroundImage:`url(${product.image})`,backgroundPosition:product.image_position}}/> : <img className={'product-photo '+className} src={product.image} alt={product.title}/>;
}
